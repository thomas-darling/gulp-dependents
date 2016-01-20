/**
 * Represents the plugin configuration.
 */
export default class PluginConfig
{
    /**
     * True to log the dependents of each file to the console; otherwise false.
     */
    public logDependents: boolean;

    /**
     * True to log the state of the dependency map to the console at the end of the stream; otherwise false.
     */
    public logDependencyMap: boolean;
}
