/**
 * Represents a configuration for a DependencyParser, specifying how it should parse the file type with which it is associated.
 */
export default class DependencyParserConfig
{
    /**
     * The sequence of RegExps and/or functions to use when parsing dependency paths from a source file.
     * Each RegExp must have the "gm" modifier and at least one capture group. Each function must accept a string and return
     * an array of captured strings. The strings captured by each RegExp or function will be passed to the next, thus iteratively
     * reducing the file content to an array of dependency file paths.
     */
    public parserSteps: (RegExp|((text: string) => string[]))[];

    /**
     * The file name prefixes to try when looking for dependency files, if the syntax does not require them to be specified
     * in dependency statements. This could be e.g. "_", which is often used as a naming convention for mixin files.
     */
    public prefixes: string[];

    /**
     * The file name postfixes to try when looking for dependency files, if the syntax does not require it to be specified
     * in dependency statements. This could be e.g. the file name extension, which is often allowed to be omitted.
     */
    public postfixes: string[];

    /**
     * The additional base paths to try when looking for dependency files referenced using relative paths, if the compiler
     * allows alternative base paths to be specified.
     */
    public basePaths: string[];
}