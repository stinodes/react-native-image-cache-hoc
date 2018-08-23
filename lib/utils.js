// @flow
import FileSystemFactory from './FileSystem';
import type { PublicAPIOpts } from './FileSystem';
import { ImageCacheFAC } from './imageCacheHoc';

export const flush = async () => {
  const fileSystem = FileSystemFactory(ImageCacheFAC.options);
  const results = await Promise.all([
    fileSystem.unlink('permanent'),
    fileSystem.unlink('cache'),
  ]);

  return {
    permanentDirFlushed: results[0],
    cacheDirFlushed: results[1],
  };
};
export const flushFile = (url: string, opts: PublicAPIOpts) => {
  const fileSystem = FileSystemFactory(ImageCacheFAC.options);
  return fileSystem.pruneFile(url, opts);
};
export const recacheFile = async (url: string, opts: PublicAPIOpts) => {
  const fileSystem = FileSystemFactory(ImageCacheFAC.options);
  await fileSystem.pruneFile(url, opts);
  return cacheFile(url, opts);
};

export const cacheFile = async (url: string, opts: PublicAPIOpts) => {
  const fileSystem = FileSystemFactory(ImageCacheFAC.options);
  const localFilePath = await fileSystem.getLocalFilePathFromUrl(url, opts);

  return {
    url: url,
    cacheType: opts.permanent ? 'permanent' : 'cache',
    localFilePath,
  };
};
