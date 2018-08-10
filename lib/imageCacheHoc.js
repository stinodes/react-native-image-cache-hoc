/**
 * @flow
 * This HOC adds the following functionality to react native <Image> components:
 *
 * - File caching. Images will be downloaded to a cache on the local file system.
 *   Cache is maintained until cache size meets a certain threshold at which point the oldest
 *   cached files are purged to make room for fresh files.
 *
 *  - File persistence. Images will be stored indefinitely on local file system.
 *    Required for images that are related to issues that have been downloaded for offline use.
 *
 * More info: https://facebook.github.io/react/docs/higher-order-components.html
 *
 */
import * as React from 'react';
import { Platform } from 'react-native';
import FileSystemFactory, { FileSystem } from '../lib/FileSystem';
import traverse from 'traverse';
import validator from 'validator';
import { getDeep, shallowMerge } from 'fnional';
import uuid from 'react-native-uuid';
import type { Options } from './FileSystem';

type FACArgsWithSource = {
  pending: false,
  rejected: false,
  source: { uri: string },
};
type FACArgsPending = {
  pending: true,
  rejected: false,
  source: null,
};
type FACArgsRejected = {
  pending: false,
  rejected: true,
  source: null,
};
type FACArgs = FACArgsWithSource | FACArgsPending | FACArgsRejected;
type FACProps = {
  headers: { [string]: string },
  permanent?: boolean,
  fileName?: string,
  extension?: string,
  onReject?: () => any,
  source: { uri: string },
  children: FACArgs => React.Node,
};
type State = {
  localFilePath: ?string,
  pending: boolean,
  rejected: boolean,
};

export class ImageCacheFAC extends React.Component<FACProps, State> {
  static options: Options = {
    validProtocols: ['https'],
    fileHostWhitelist: [],
    cachePruneTriggerLimit: 1024 * 1024 * 15, // Maximum size of image file cache in bytes before pruning occurs. Defaults to 15 MB.
    fileDirName: 'react-native-image-cache-hoc', // Namespace local file writing to this directory. Defaults to 'react-native-image-cache-hoc'.
  };
  static setOptions = (options: Options) => {
    ImageCacheFAC.options = shallowMerge(ImageCacheFAC.options, options);
  };

  state = {
    pending: false,
    localFilePath: null,
    rejected: false,
  };

  componentId: string;
  _isMounted: boolean;
  fileSystem: FileSystem;

  constructor(props: FACProps) {
    super(props);

    // Assign component unique ID for cache locking.
    this.componentId = uuid.v4();

    // Track component mount status to avoid calling setState() on unmounted component.
    this._isMounted = false;

    // Init file system lib
    this.fileSystem = FileSystemFactory(ImageCacheFAC.options);

    // Validate input
    this._validateImageComponent();
  }

  _validateImageComponent() {
    // Define validator options
    let validatorUrlOptions = {
      protocols: ImageCacheFAC.options.validProtocols,
      require_protocol: true,
      host_whitelist: [],
    };
    if (ImageCacheFAC.options.fileHostWhitelist.length) {
      validatorUrlOptions.host_whitelist =
        ImageCacheFAC.options.fileHostWhitelist;
    }

    // Validate source prop to be a valid web accessible url.
    if (
      !getDeep(this.props, ['source', 'uri']) ||
      !validator.isURL(
        getDeep(this.props, ['source', 'uri']),
        validatorUrlOptions,
      )
    ) {
      throw new Error(
        'Invalid source prop. <CacheableImage> props.source.uri should be a web accessible url with a valid protocol and host. NOTE: Default valid protocol is https, default valid hosts are *.',
      );
    } else {
      return true;
    }
  }

  // Async calls to local FS or network should occur here.
  // See: https://reactjs.org/docs/react-component.html#componentdidmount
  async componentDidMount() {
    // Track component mount status to avoid calling setState() on unmounted component.
    this._isMounted = true;

    // Set url from source prop
    const url = traverse(this.props).get(['source', 'uri']);

    // Add a cache lock to file with this name (prevents concurrent <CacheableImage> components from pruning a file with this name from cache).
    const fileName =
      this.props.fileName ||
      (await this.fileSystem.getFileNameFromUrl(url, {
        headers: this.props.headers,
        extension: this.props.extension,
        fileName: this.props.fileName,
      }));
    FileSystem.lockCacheFile(fileName, this.componentId);

    // Init the image cache logic
    await this._loadImage();
  }
  /**
   *
   * Enables caching logic to work if component source prop is updated (that is, the image url changes without mounting a new component).
   */
  async componentWillReceiveProps(prevProps: FACProps) {
    // Set urls from source prop data
    const prevUrl = getDeep(prevProps, ['source', 'uri']);
    const url = getDeep(this.props, ['source', 'uri']);

    // Do nothing if url has not changed.
    if (url === prevUrl) return;

    this.handleSourceChange(prevProps);
  }

  handleSourceChange = async (prevProps: FACProps) => {
    const prevUrl = getDeep(prevProps, ['source', 'uri']);
    const url = getDeep(this.props, ['source', 'uri']);
    // Remove component cache lock on old image file, and add cache lock to new image file.
    const prevFileName =
      prevProps.fileName ||
      (await this.fileSystem.getFileNameFromUrl(prevUrl, {
        extension: prevProps.extension,
        fileName: prevProps.fileName,
        headers: prevProps.headers,
      }));
    const fileName =
      this.props.fileName ||
      (await this.fileSystem.getFileNameFromUrl(url, {
        headers: this.props.headers,
        fileName: this.props.fileName,
        extension: this.props.extension,
      }));

    FileSystem.unlockCacheFile(prevFileName, this.componentId);
    FileSystem.lockCacheFile(fileName, this.componentId);

    // Init the image cache logic
    await this._loadImage();
  };

  async _loadImage() {
    // Check local fs for file, fallback to network and write file to disk if local file not found.
    this.setState({ pending: true, rejected: false, localFilePath: null });
    let localFilePath = null;

    try {
      const url = getDeep(this.props, ['source', 'uri']);
      localFilePath = await this.fileSystem.getLocalFilePathFromUrl(url, {
        permanent: this.props.permanent,
        extension: this.props.extension,
        fileName: this.props.fileName,
        headers: this.props.headers,
      });
    } catch (error) {
      console.warn(error); // eslint-disable-line no-console
      this.props.onReject && this.props.onReject();
      this.setState({ rejected: true, pending: false });
    }

    // Check component is still mounted to avoid calling setState() on components that were quickly
    // mounted then unmounted before componentDidMount() finishes.
    // See: https://github.com/billmalarky/react-native-image-cache-hoc/issues/6#issuecomment-354490597
    if (this._isMounted && localFilePath) {
      this.setState({ localFilePath, rejected: false, pending: false });
    }
  }

  async componentWillUnmount() {
    // Track component mount status to avoid calling setState() on unmounted component.
    this._isMounted = false;

    // Remove component cache lock on associated image file on component teardown.
    let fileName = await this.fileSystem.getFileNameFromUrl(
      getDeep(this.props, ['source', 'uri']),
      {
        headers: this.props.headers,
        fileName: this.props.fileName,
        extension: this.props.extension,
      },
    );
    FileSystem.unlockCacheFile(fileName, this.componentId);
  }

  render() {
    const { children } = this.props;
    const { pending, localFilePath } = this.state;
    if (pending)
      return children({ pending: true, source: null, rejected: false });
    if (localFilePath) {
      let platformSpecificPath = localFilePath;
      if (Platform.OS === 'android')
        platformSpecificPath = 'file://' + localFilePath;
      return children({
        pending: false,
        source: { uri: platformSpecificPath },
        rejected: false,
      });
    }
    return children({ pending: false, source: null, rejected: true });
  }
}

type CompProps = {
  source: ?{ uri: string },
};
type HOCProps = {
  ...FACProps,
  children: React.Node,
  renderPlaceholder: () => React.Node,
  renderRejected: () => React.Node,
};
export const imageCache = function(
  options: ?Options,
): (React.ComponentType<CompProps>) => React.ComponentType<HOCProps> {
  return Component => {
    if (options) ImageCacheFAC.setOptions(options);

    class CacheImage extends React.PureComponent<HOCProps> {
      render() {
        const {
          children,
          renderPlaceholder,
          renderRejected,
          headers,
          permanent,
          fileName,
          extension,
          source: facSource,
          onReject,
          ...props
        } = this.props;
        const facProps = {
          headers,
          permanent,
          fileName,
          extension,
          onReject,
          source: facSource,
        };
        return (
          <ImageCacheFAC {...facProps}>
            {({ source, pending, rejected }) => {
              if (pending && renderPlaceholder) return renderPlaceholder();
              if (rejected && renderRejected) return renderRejected();
              return (
                <Component {...props} source={source}>
                  {children}
                </Component>
              );
            }}
          </ImageCacheFAC>
        );
      }
    }

    return CacheImage;
  };
};
