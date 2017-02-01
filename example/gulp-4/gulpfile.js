var gulp = require("gulp");
var dependents = require("../../");
var debug = require("gulp-debug");

// The parser configuration, in which keys represents file name
// extensions, including the dot, and values represent the config
// to use when parsing the file type.
var config =
 {
    ".scss":
    {
        // The sequence of RegExps and/or functions to use when parsing
        // dependency paths from a source file. Each RegExp must have the
        // 'gm' modifier and at least one capture group. Each function must
        // accept a string and return an array of captured strings. The
        // strings captured by each RegExp or function will be passed
        // to the next, thus iteratively reducing the file content to an
        // array of dependency file paths.
        parserSteps:
        [
            // Please note:
            // The parser steps shown here are only meant to illustrate
            // the concept of a matching pipeline. The actual config used
            // for scss files is pure RegExp and reliably supports the
            // full syntax for import statements.

            // Match the import statements and capture the text
            // between "@import" and ";".
            /^\s*@import\s+(.+?);/gm,

            // Split the captured text on "," to get each path.
            function (text) { return text.split(","); },

            // Match the balanced quotes and capture only the file path.
            /"([^"]+)"|'([^']+)'/gm
        ],

        // The file name prefixes to try when looking for dependency
        // files, if the syntax does not require them to be specified in
        // dependency statements. This could be e.g. '_', which is often
        // used as a naming convention for mixin files.
        prefixes: ["_"],

        // The file name postfixes to try when looking for dependency
        // files, if the syntax does not require them to be specified in
        // dependency statements. This could be e.g. file name extensions.
        postfixes: [".scss"],

        // The additional base paths to try when looking for dependency
        // files referenced using relative paths.
        basePaths: ["source"],
    }
};

gulp.task("build", function ()
{
    return gulp

        // Get all source files.
        .src("source/**/*.scss", { since: gulp.lastRun('build') })

        // Add any dependent files to the stream.
        .pipe(dependents(config, { logDependents: true, logDependencyMap: false }))

        // For debugging, just output the name of each file we're about to build.
        .pipe(debug({ title: "[build]" }));
});

gulp.task("watch", function ()
{
    gulp.watch("source/**/*.scss", gulp.series("build"));
});