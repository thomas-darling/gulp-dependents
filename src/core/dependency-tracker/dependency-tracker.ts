import * as util from "gulp-util";

/**
 * Represents a dependency tracker, which tracks the files that pass through and the dependencies between them.
 */
export interface IDependencyTracker
{
    /**
     * Updates the dependency map, returning the set of files that depend on the specified file.
     * @param file The file that should be tracked and analyzed.
     * @param encoding The name of the encoding used in the file.
     * @return The files dependend files, or null, if no dependents should be added to the stream.
     */
    updateAndGetDependents(file: util.File, encoding: string): util.File[];

    /**
     * Logs the specified dependency and its dependents to the console.
     * @param filePath The file path for which dependents should be logged.
     * @param recursive True to perform a recursive search; otherwise false.
     */
    logDependents(filePath: string, recursive: boolean): void;

    /**
     * Logs the state of the dependency map to the console.
     * Note that this lists only dependencies and their dependents; files without dependencies
     * are not listed, except as dependents, even though they are in fact tracked.
     */
    logDependencyMap(): void;
}
