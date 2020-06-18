import File from "vinyl";
import * as path from "path";
import * as fs from "fs";
import {IDependencyParser} from "../dependency-parser";
import {IDependencyParserConfig} from "../dependency-parser-config";

/**
 * Represents the default configuration for the dependency tracker, specifying
 * how dependencies should be parsed from each of the supported file types.
 */
export const defaultConfig =
    {
        ".pcss":
        {
            postfixes: [".pcss"],
            parserSteps:
            [
                /(?:^|;|}|\*\/)\s*@import\s+(?:"([^"]+)"|'([^']+)'|url\((?:"([^"]+)"|'([^']+)'|([^)]+))\))/gm
            ]
        },
        ".less":
        {
            parserSteps:
            [
                // The language semantics only allow import statements with a single file path.
                // Therefore, we can extract the path directly.
                /(?:^|;|}|\*\/)\s*@import\s+(?:\([^)]*\)\s*)?(?:"([^"]+)"|'([^']+)'|url\((?:"([^"]+)"|'([^']+)'|([^)]+))\))(?=;)/gm
            ],
            prefixes: [],
            postfixes: [".less"],
            basePaths: []
        },

        ".scss":
        {
            parserSteps:
            [
                // The language semantics allow import statements with a comma-separated list of file paths.
                // Therefore, we first extract the whole statement, and then extract each of the paths from that.
                /(?:^|;|{|}|\*\/)\s*@(import|use|forward)\s+((?:"[^"]+"|'[^']+'|url\((?:"[^"]+"|'[^']+'|[^)]+)\))(?:\s*,\s*(?:"[^"]+"|'[^']+'|url\((?:"[^"]+"|'[^']+'|[^)]+)\)))*)(?=[^;]*;)/gm,
                /"([^"]+)"|'([^']+)'|url\((?:"([^"]+)"|'([^']+)'|([^)]+))\)/gm
            ],
            prefixes: ["_"],
            postfixes: [".scss", ".sass"],
            basePaths: []
        },

        ".sass":
        {
            parserSteps:
            [
                // The exact language semantics are not well documented, but it appears it might allow multi-line import statements.
                // However, we only support single-line statements, as RegExp is not good at reliably matching indent-based syntax.
                /^\s*@import\s+(.*)$/gm,
                /"([^"]+)"|'([^']+)'|url\((?:"([^"]+)"|'([^']+)'|([^)]+))\)|([^\s]+)/gm
            ],
            prefixes: ["_"],
            postfixes: [".scss", ".sass"],
            basePaths: []
        }
    };

/**
 * Represents a parser that extracts dependency file paths from a file.
 */
export class DependencyParser implements IDependencyParser
{
    /**
     * The configuration describing how files should be parsed.
     */
    public config = {};

    /**
     * Creates a new instance of the type.
     * @param config The configuration to merge with the default configuration.
     */
    constructor(config?: {})
    {
        // Apply the default config.
        this.applyConfig(defaultConfig);

        // Apply the custom config.
        this.applyConfig(config);
    }

    /**
     * Parses the specified file, returning the set of dependency file paths on which it depends.
     * @param file The file for which dependencies should be returned.
     * @param encoding The name of the encoding used in the file.
     * @return The set of file paths on which the file depends.
     */
    public getDependencyFilePaths(file: File, encoding: string): string[]
    {
        // Get the configuration for the file type.
        const config = this.config[path.extname(file.path).toLowerCase()] as IDependencyParserConfig;

        // Ignore file types for which we have no config.
        if (!config)
        {
            return null;
        }

        // Get the dependency paths specified in the file.
        let dependencyPaths = this.parseFile(file, config);

        // Ignore dependency paths representing URL's.
        dependencyPaths = dependencyPaths.filter(function (path)
        {
            return !path.match(/http:|https:|ftp:|file:/);
        });


        // Add path variants for all prefix and postfix variants.

        if (config.prefixes)
        {
            this.getPrefixedPathVariants(dependencyPaths, config)
                .forEach(dependencyPath => dependencyPaths.push(dependencyPath));
        }

        if (config.postfixes)
        {
            this.getPostfixedPathVariants(dependencyPaths, config)
                .forEach(dependencyPath => dependencyPaths.push(dependencyPath));
        }

        if (config.basePaths)
        {
            this.getBasePathVariants(dependencyPaths, config)
                .map(dependencyPath => path.resolve(path.dirname(file.base), dependencyPath))
                .forEach(dependencyPath => dependencyPaths.push(dependencyPath));
        }

        // Reduce the list of paths to a unique set of normalized paths.
        let uniqueDependencyPaths = {};
        dependencyPaths.forEach(dependencyPath => uniqueDependencyPaths[path.normalize(dependencyPath)] = true);

        // Resolve paths to absolute paths.
        return Object.keys(uniqueDependencyPaths)
            .map(dependencyPath => path.resolve(path.dirname(file.path), dependencyPath));
    }

    /**
     * Parses the specified file, returning the set of paths specified in its dependency statements.
     * Note that those are not yet valid file paths, as prefixes and postfixes may be missing.
     * @param file The file for which dependency paths should be returned.
     * @param config The parser config for the file type being parsed.
     * @return The set of paths specified in the files dependency statements.
     */
    private parseFile(file: File, config: IDependencyParserConfig): string[]
    {
        // Read the file contents as a string.
        const fileContents = file.contents.toString();

        // Iteratively reduce the file contents to a set of dependency references.

        let dependencyPaths: string[] = [fileContents];

        for (let regExpOrFunc of config.parserSteps)
        {
            dependencyPaths = this.getMatches(dependencyPaths, regExpOrFunc);
        }

        return dependencyPaths;
    }

    /**
     * Applies the specified RegExp or function to each of the specified texts, aggregating all the captured
     * values into a single list.
     * @param texts The texts against which the RegExp or function should be executed.
     * @param regExpOrFunc The RegExp or function to be executed. If the parameter is a RegExp, it must have
     * a single capture group representing the string to be matched. If the parameter is a function, it must
     * accept a string and return an array of matched strings.
     * @return An array containing all the matches found in all the texts.
     */
    private getMatches(texts: string[], regExpOrFunc: RegExp | ((text: string) => string[])): string[]
    {
        let results: string[] = [];

        for (let text of texts)
        {
            if (regExpOrFunc instanceof Function)
            {
                for (let match of regExpOrFunc(text))
                {
                    if (match != null)
                    {
                        results.push(match);
                    }
                }
            }
            else if (regExpOrFunc instanceof RegExp)
            {
                let match: RegExpExecArray;

                while (match = regExpOrFunc.exec(text))
                {
                    for (let i = 1; i < match.length; i++)
                    {
                        if (match[i] != null)
                        {
                            results.push(match[i]);
                        }
                    }
                }
            }
        }

        return results;
    }

    /**
     * Applies the prefixes in the specified config to the specified paths, returning the resulting set of path variants.
     * @param dependencyPaths The dependency paths for which variants should be returned.
     * @param config The parser config for the file type being parsed.
     * @return A list of prefixed path variants.
     */
    private getPrefixedPathVariants(dependencyPaths: string[], config: IDependencyParserConfig): string[]
    {
        let variants: string[] = [];

        for (let dependencyPath of dependencyPaths)
        {
            for (let prefix of config.prefixes)
            {
                let variant = path.join(path.dirname(dependencyPath), prefix + path.basename(dependencyPath));
                variants.push(variant);
            }
        }

        return variants;
    }

    /**
     * Applies the postfixes in the specified config to the specified paths, returning the resulting set of path variants.
     * @param dependencyPaths The dependency paths for which variants should be returned.
     * @param config The parser config for the file type being parsed.
     * @return A list of path variants, with default file names appended to each folder path.
     */
    private getPostfixedPathVariants(dependencyPaths: string[], config: IDependencyParserConfig): string[]
    {
        let variants: string[] = [];

        for (let dependencyPath of dependencyPaths)
        {
            for (let postfix of config.postfixes)
            {
                let variant = dependencyPath + postfix;
                variants.push(variant);
            }
        }

        return variants;
    }

    /**
     * Applies the alternate base paths in the specified config to the specified paths, returning the resulting set of path variants.
     * @param dependencyPaths The dependency paths for which variants should be returned.
     * @param config The parser config for the file type being parsed.
     * @return A list of postfixed path variants.
     */
    private getBasePathVariants(dependencyPaths: string[], config: IDependencyParserConfig): string[]
    {
        let variants: string[] = [];

        for (let dependencyPath of dependencyPaths)
        {
            // HACK: We should use path.isAbsolute(...), but it's not supported by the node version shipping with Visual Studio.
            if (!dependencyPath.match(/^[\/]/) && !dependencyPath.match(/^.*:/))
            {
                for (let basePath of config.basePaths)
                {
                    let variant = path.join(basePath, dependencyPath);
                    variants.push(variant);
                }
            }
        }

        return variants;
    }

    /**
     * Applies the specified configuration by merging it into the current configuration.
     * @param config The configuration to merge with the current configuration.
     */
    private applyConfig(config: {}): void
    {
        if (config)
        {
            for (let fileNameExtension of Object.keys(config))
            {
                let currentConfig = config[fileNameExtension];

                if (!currentConfig)
                {
                    this.config[fileNameExtension] = null;
                }
                else if (!this.config[fileNameExtension])
                {
                    if (!currentConfig.parserSteps || !currentConfig.parserSteps.length)
                    {
                        throw new Error("A new file type configuration must specify at least one RegExp.");
                    }

                    this.config[fileNameExtension] = currentConfig;
                }
                else
                {
                    for (let key of Object.keys(currentConfig))
                    {
                        this.config[fileNameExtension][key] = currentConfig[key];
                    }
                }
            }
        }
    }
}
