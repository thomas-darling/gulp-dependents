import * as util from "gulp-util";
import * as path from "path";
import * as fs from "fs";
import IDependencyTracker from "./IDependencyTracker";
import IDependencyParser from "./IDependencyParser";

/**
 * Represents a dependency tracker, which tracks the files that pass through and the dependencies between them.
 * It assumes that it will be used in such a way, that after the instance has been created, the first sequence of 
 * files passed to the tracker represent all the files between which dependencies may exist. This is nessesary to 
 * set up the initial dependency map, such that when a dependency is changed, we knows which files depend on it.
 *
 * A typical Gulp setup satisfying the above requirement involves two tasks:
 * - A 'build' task, which pipes all files through first the 'gulp-cached' plugin, and then through this plugin.
 * - A 'watch' task, which watches the files, and invokes the 'build' task whenever a file changes.
 * This works because the 'gulp-cached' plugin will pass through, and cache, only the files that are not already 
 * in the cache or which have changed compared to the cached version. Alternatively, you may use the 'gulp-watch'
 * plugin, which creates an infinite stream that initially pass through all files, and after that, only changes.
 */
export default class DependencyTracker implements IDependencyTracker
{
    /**
     * The parser used to extract dependency file paths from files.
     */
    private dependencyParser: IDependencyParser;

    /**
     * Object representing a map, where a truthy value indicate the existence of the dependency defined by the keys.
     * Example: dependencyMap[dependencyFilePath][filePath] == true ~ filePath depends on dependencyFilePath.
     */
    private dependencyMap = {};

    /**
     * Object representing a set, where a truthy value indicate that the file defined by the key is being tracked.
     * Example: trackedFilePaths[filePath] == true ~ filePath is being tracked.
     */
    private trackedFilePaths = {};

    /**
     * Creates a new instance of the type. 
     * @param dependencyParser The parser used to extract dependency file paths from files.
     */
    constructor(dependencyParser: IDependencyParser)
    {
        if (dependencyParser == null)
        {
            throw new Error("The 'dependencyParser' argument is null or undefined.");
        }

        this.dependencyParser = dependencyParser;
    }

    /**
     * Updates the dependency map, returning the set of files that depend on the specified file.
     * @param file The file that should be tracked and analyzed.
     * @param encoding The name of the encoding used in the file.
     * @return The files dependend files, or null, if no dependents should be added to the stream.
     */
    public updateAndGetDependents(file: util.File, encoding: string): util.File[]
    {
        if (file == null)
        {
            throw new Error("The 'file' argument is null or undefined.");
        }

        // Normalize the file path to ensure consistent behavior.
        const filePath = path.normalize(file.path);

        // Check whether the file path is tracked, in which case its dependents should be returned.
        const shouldReturnDependents = this.trackedFilePaths[filePath];

        // Mark the file path as tracked.
        this.trackedFilePaths[filePath] = true;

        // Only parse the file if it has non-null content.
        if (!file.isNull())
        {
            // Remove existing dependency mappings for the file.
            for (let dependencyFilePath of Object.keys(this.dependencyMap))
            {
                delete this.dependencyMap[dependencyFilePath][filePath];

                // If the dependency has no dependents left, remove it from the map.
                if (!Object.keys(this.dependencyMap[dependencyFilePath]).length)
                {
                    delete this.dependencyMap[dependencyFilePath];
                }
            }

            // Get the dependency file paths parsed from the file.
            const dependencyFilePaths = this.dependencyParser.getDependencyFilePaths(file, encoding);

            // Ignore the file if the parser did not know how to parse it.
            if (!dependencyFilePaths)
            {
                return null;
            }

            // Add the normalized dependency file paths to the map.
            for (let dependencyFilePath of dependencyFilePaths.map(p => path.normalize(p)))
            {
                // If the dependency file is missing in the file system, ensure its path is marked 
                // as tracked, so we know to process its dependents if it is added later.
                if (!this.trackedFilePaths[dependencyFilePath] && !fs.existsSync(dependencyFilePath))
                {
                    this.trackedFilePaths[dependencyFilePath] = true;
                }

                // Add the dependency mapping.

                if (!this.dependencyMap[dependencyFilePath])
                {
                    this.dependencyMap[dependencyFilePath] = {};
                }

                this.dependencyMap[dependencyFilePath][filePath] = true;
            }
        }

        // If this is the first time we encounter the file, and it isn't tracked as a missing dependency, then 
        // it is assumed that we're still in the initial run, where all files should already be in the stream.
        // We therefore should not add dependents, as they will be processed anyway.
        if (!shouldReturnDependents)
        {
            return null;
        }
        
        // Recursively find the file paths for all files that depend on the specified file.
        // If a dependent file no longer exists, it will not be included, and will be removed from the map.
        const dependentFilePaths = this.getDependentFilePaths(filePath, true, true);

        // Return the set of files that depend on the current file.
        // We return those dependents even if the current file itself does not exist; all we do here is to find 
        // the dependents, and if one is missing, it is up to the actual build tool to report that as an error.
        return dependentFilePaths.map(dependentFilePath =>
        {
            return new util.File({
                cwd: file.cwd,
                base: file.base,
                path: dependentFilePath,
                contents: fs.readFileSync(dependentFilePath)
            });
        });
    }

    /**
     * Logs the state of the dependency map to the console.
     * Note that this lists only dependencies and their dependents; files without dependencies 
     * are not listed, except as dependents, even though they are in fact tracked.
     * @param basePath The absolute base path, or null to log absolute file paths.
     */
    public logDependencyMap(basePath?: string): void
    {
        let text = "Tracked dependencies and their dependents";

        for (let filePath of Object.keys(this.dependencyMap))
        {
            text += "\n ─┬─ " + this.formatPathForDisplay(filePath, basePath);

            const dependentFilePaths = Object.keys(this.dependencyMap[filePath]);

            for (let i = 0; i < dependentFilePaths.length - 1; i++)
            {
                text += "\n  ├─ " + this.formatPathForDisplay(dependentFilePaths[i], basePath);
            }

            if (dependentFilePaths.length > 0)
            {
                text += "\n  └─ " + this.formatPathForDisplay(dependentFilePaths[dependentFilePaths.length - 1], basePath);
            }
            else
            {
                text += "\n  └─ File has no dependents.";
            }
        }

        util.log(text);
    }

    /**
     * Logs the specified dependency and its dependents to the console.
     * @param filePath The file path for which dependents should be logged.
     * @param recursive True to perform a recursive search; otherwise false.
     * @param basePath The absolute base path, or null to log absolute file paths.
     */
    public logDependents(filePath: string, recursive: boolean, basePath?: string): void
    {
        let dependentFilePaths: string[];

        if (recursive)
        {
            dependentFilePaths = this.getDependentFilePaths(filePath, recursive, false);
        }
        else
        {
            dependentFilePaths = Object.keys(this.dependencyMap[filePath] || {});
        }

        let text = "Dependents (" + dependentFilePaths.length + ")";

        text += "\n ─┬─ " + this.formatPathForDisplay(filePath, basePath);

        if (this.trackedFilePaths[filePath])
        {
            for (let i = 0; i < dependentFilePaths.length - 1; i++)
            {
                text += "\n  ├─ " + this.formatPathForDisplay(dependentFilePaths[i], basePath);
            }

            if (dependentFilePaths.length > 0)
            {
                text += "\n  └─ " + this.formatPathForDisplay(dependentFilePaths[dependentFilePaths.length - 1], basePath);
            }
            else
            {
                text += "\n  └─ File has no dependents.";
            }
        }
        else
        {
            text += "\n  └─ Unknown: File is not tracked.";
        }

        util.log(text);
    }

    /**
     * Formats the specified path as a path relative to a base path, or returns it unmodified if it is outside the base path.
     * @param absolutePath The absolute path to format.
     * @param basePath The absolute base path, or null to return the absolute path.
     * @return The relative path from the base path to the specified path, or an absolute path it is if outside the base path.
     */
    private formatPathForDisplay(absolutePath: string, basePath: string)
    {
        if (!basePath)
        {
            return absolutePath;
        }

        var relativePath = path.relative(basePath, absolutePath);

        return relativePath.match(/^\.\./) ? absolutePath : relativePath;
    }

    /**
     * Searches the dependency map to find the set of files that depend on the specified file path.
     * @param filePath The file path for which dependent files should be found.
     * @param recursive True to perform a recursive search; otherwise false.
     * @param checkFilesExist True to remove file paths that do not exist in the file system from the map.
     * @return The set of dependent file paths.
     */
    private getDependentFilePaths(filePath: string, recursive: boolean, checkFilesExist: boolean): string[]
    {
        const dependentFilePaths = {};

        getDependentFilePaths(this.dependencyMap, filePath);

        return Object.keys(dependentFilePaths);

        function getDependentFilePaths(dependencyMap: {}, filePath: string): void
        {
            // Do we have a set of dependents?
            if (dependencyMap[filePath])
            {
                for (let dependentFilePath of Object.keys(dependencyMap[filePath]))
                {
                    // Should we check the path, and if so, does the file exist?
                    if (!checkFilesExist || fs.existsSync(dependentFilePath))
                    {
                        // Add the file to the set of dependent files.
                        dependentFilePaths[dependentFilePath] = true;

                        // Recursively look for more dependents?
                        if (recursive)
                        {
                            getDependentFilePaths(dependencyMap, dependentFilePath);
                        }
                    }
                    else
                    {
                        // The file has been deleted and is therefore no longer a dependent.
                        for (let dependencyFilePath of Object.keys(dependencyMap))
                        {
                            delete dependencyMap[dependencyFilePath][dependentFilePath];
                            
                            // If the dependency has no dependents left, remove it from the map.
                            if (!Object.keys(dependencyMap[dependencyFilePath]).length)
                            {
                                delete dependencyMap[dependencyFilePath];
                            }
                        }
                    }
                }
            }
        }
    }
}
