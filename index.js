/**
 * Bootstrap.
 *
 * @module imageCacheHoc
 */

'use strict';
import FileSystemFactory, { FileSystem } from './lib/FileSystem';

export * from './lib/imageCacheHoc';
export { FileSystemFactory, FileSystem }; // Allow access to FS logic for advanced users.
