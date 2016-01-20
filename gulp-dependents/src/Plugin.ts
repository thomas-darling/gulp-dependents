import * as util from "gulp-util";
import * as path from "path";
import * as through from "through2";
import PluginConfig from "./PluginConfig";
import DependencyParser from "./DependencyParser";
import DependencyTracker from "./DependencyTracker";

/**
 * Represents the plugin.
 */
export default class Plugin
{
    /**
     * The static dependency tracker instance.
     */
    private static dependencyTracker: DependencyTracker;

    /**
     * Creates a new instance of the plugin. 
     * @param parserConfig The parser configuration use, null, undefined or empty string to use the default configuration, or an instance of a custom IDependencyParser.
     * @param pluginConfig The debug configuration use, or null or undefined to disable all debug options.
     */
    public static run(parserConfig?: {}, pluginConfig?: PluginConfig)
    {
        // Get or create the debug options.
        if (!pluginConfig)
        {
            pluginConfig = new PluginConfig();
        }

        // Get or create the dependency parser and tracker.

        if (Plugin.dependencyTracker == null)
        {
            Plugin.dependencyTracker = new DependencyTracker(new DependencyParser(parserConfig));
        }
        
        // Return the stream transform.
        return through.obj(
            function (file: util.File, encoding, callback)
            {
                // Get the files that depend on the current file.
                let dependentFiles = Plugin.dependencyTracker.updateAndGetDependents(file, encoding);

                // Should we log the dependents to the console?
                if (dependentFiles != null && pluginConfig.logDependents)
                {
                    Plugin.dependencyTracker.logDependents(path.normalize(file.path), true, process.cwd());
                }

                // Push the current file to the stream.
                this.push(file);

                // If the current file is tracked, add its dependents to the stream.
                if (dependentFiles != null)
                {
                    for (let dependentFile of dependentFiles)
                    {
                        this.push(dependentFile);
                    }
                }

                callback();
            },
            function (callback)
            {
                // Should we log the dependency map to the console?
                if (pluginConfig.logDependencyMap)
                {
                    Plugin.dependencyTracker.logDependencyMap(process.cwd());
                }

                callback();
            });
    }
}
