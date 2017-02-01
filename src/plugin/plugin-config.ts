/**
 * Represents the plugin configuration.
 */
export interface IPluginConfig
{
    /**
     * True to log the dependents of each file to the console; otherwise false.
     */
    logDependents?: boolean;

    /**
     * True to log the state of the dependency map to the console at the end of the stream; otherwise false.
     */
    logDependencyMap?: boolean;
}
