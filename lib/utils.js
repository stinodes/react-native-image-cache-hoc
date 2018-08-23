// @flow
import FileSystemFactory from './FileSystem';
import type { PublicAPIOpts } from './FileSystem';
import { ImageCacheFAC } from './imageCacheHoc';

class PruneHandler {
  static handlers = {};
  static add = (url: string, callback: string => any) => {
    let handlers = PruneHandler.handlers[url];
    if (!handlers) handlers = [];
    handlers = [...handlers, callback];
    PruneHandler.handlers[url] = handlers;
    return () => PruneHandler.remove(url, callback);
  };
  static remove = (url: string, callback: string => any) => {
    let handlers = PruneHandler.handlers[url];
    if (!handlers) return;
    handlers = handlers.filter(cb => callback !== cb);
    PruneHandler.handlers[url] = handlers;
  };
  static trigger = (url: string) => {
    const handlers = PruneHandler.handlers[url];
    if (!handlers) return;
    handlers.forEach(handler => handler(url));
  };
}

export const onPruned = PruneHandler.add;
export const resetForUrl = PruneHandler.trigger;

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

export const flushFile = async (url: string, opts: PublicAPIOpts) => {
  const fileSystem = FileSystemFactory(ImageCacheFAC.options);
  await fileSystem.pruneFile(url, opts);
  PruneHandler.trigger(url);
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
