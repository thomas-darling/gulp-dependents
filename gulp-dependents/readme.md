gulp-dependents
===============
Gulp plugin that tracks dependencies between files and adds any files that depend
on the files currently in the stream, thus enabling incremental build of `pcss`,
`less`, `scss` and `sass` files, with extensibility points to support other file
types.

## Problem
Gulp makes it easy to build all your files, but as the code base grows, so does
the build time, significantly slowing down your workflow. The solution is 
incremental building - i.e. to rebuild only the files that have actually changed.
Unfortunately Gulp is agnostic about the depenencies between your files, making
it hard to incrementally build files that depend on other files - it doesn't know,
that when a dependency changes, so does the files that depend on it.

## Solution
This plugin tracks the dependencies of all the files that pass trough it, building
and maintaining an in-memory dependency tree describing the dependencies between
the files. For each file that passes through, it will add any files that directly
or indirectly depend on that file to the stream, thus ensuring that they will also
be rebuild. Combined with e.g. the [gulp-cached](https://www.npmjs.com/package/gulp-cached)
plugin, or the "since last run" option in Gulp 4, this enables fast and reliable
incremental builds.

## Usage
This example shows how the plugin may be used to watch and incrementally build
`less` files. The `gulp-cached` plugin will pass all files through on the first
run, thus allowing `gulp-dependents` to set up the initial dependency graph. On
subsequent runs, only changed files will be passed through, and `gulp-dependents`
will then ensure that any dependent files are also pulled into the stream.

```javascript

var gulp = require('gulp'),
    less = require('gulp-less'),
    cached = require('gulp-cached'),
    dependents = require('gulp-dependents');

gulp.task('watch.less', function() {
    gulp.watch('src/**/*.less', ['build.less']);
});

gulp.task('build.less', function() {
    return gulp
        .src('src/**/*.less')
        .pipe(cached('less'))
        .pipe(dependents())
        .pipe(less())
        .pipe(gulp.dest('dist'))
});

```

Note that `gulp-cached` and `gulp-changed` have different behavior - `gulp-changed`
will *not* nessesarily pass all files through on first run. Instead, it compares the
timestamps of the source and destination files, and only pass through those that appear
to be different. This means, that you must clean your output folder every time your 
watch task starts, as this plugin needs to process all files at least once, in order to 
determine the initial dependency tree - it won't know a file depends on another, 
until it has parsed its dependency statements at least once.

## Support and limitations
Out of the box, this plugin supports `pcss`, `less`, `scss` and `sass` files, including 
things like comma-separated path lists, import statements spanning multiple lines
and `url(...)` paths. For `sass`, which is the indent-based variant of the `scss`
syntax, support is limited to single-line statements. Also note, that due to the
way tracking is implemented, it is currently not be possible to support dependency 
statements with glob patterns, referencing e.g. all files in a folder. 

## Configuration
For the file types supported out of the box, there's generally no need to
configure anything, but should the need arise, a parser configuration may be
passed to the plugin function. Note that the options are merged into the 
default configuration, so if you only wish to override e.g. the `basePaths` 
option for  `scss` files, then simply specify only that property.

The parser will apply each `RegExp` or `function` in the `parserSteps` array in
sequence, such that the first receives all the file content and may e.g. extract
whole dependency statements, and the second one may then extract the paths from
those statements. This design enables parsing of complex statements that e.g.
list multiple, comma-separated file paths. It also enables the use of externa
parsers, by specifying a function, which simply invokes the external parser to 
get the dependency paths.

```javascript

// The parser configuration, in which keys represents file name 
// extensions, including the dot, and values represent the config
// to use when parsing the file type.
var config = {

    ".scss": {

        // The sequence of RegExps and/or functions to use when parsing 
        // dependency paths from a source file. Each RegExp must have the
        // 'gm' modifier and at least one capture group. Each function must
        // accept a string and return an array of captured strings. The 
        // strings captured by each RegExp or function will be passed
        // to the next, thus iteratively reducing the file content to an
        // array of dependency file paths.
        parserSteps: [

            // PLEASE NOTE:
            // The parser steps shown here are only meant as an example to 
			// illustrate the concept of the matching pipeline.
            // The default config used for scss files is pure RegExp and
            // reliably supports the full syntax of scss import statements.

            // Match the import statements and capture the text 
            // between '@import' and ';'.
            /^\s*@import\s+(.+?);/gm,

            // Split the captured text on ',' to get each path. 
            function (text) { return text.split(","); },

            // Match the balanced quotes and capture only the file path.
            /"([^"]+)"|'([^']+)'/m
        ],

        // The file name prefixes to try when looking for dependency
        // files, if the syntax does not require them to be specified in
        // dependency statements. This could be e.g. '_', which is often
        // used as a naming convention for mixin files.
        prefixes: ['_'],

        // The file name postfixes to try when looking for dependency
        // files, if the syntax does not require them to be specified in
        // dependency statements. This could be e.g. file name extensions.
        postfixes: ['.scss', '.sass'],

        // The additional base paths to try when looking for dependency
        // files referenced using relative paths.
        basePaths: [],
    }
};

// Pass the config object to the plugin function.
.pipe(dependents(config))

// You can also pass a second config argument to enable logging.
.pipe(dependents(config, { logDependents: true }))

```

## Why this plugin?
There exist a couple of other plugins similar to this, also trying to solve the 
incremental build problem. Unfortunately, in our experience, none of them seem 
to do so reliably, and when they fail, it is often in subtle ways, such as:

* Failing to correctly normalize file paths on both Windows and Unix platforms.

* Failing to correctly support the full syntax for dependency statements in `less`
  and `scss` files, or relying on outdated versions of e.g. the `less` parser.

* Failing to correctly update the dependency tree when import statements or 
  files are removed, thus building files unnessesarily or crashing due to 
  missing files.

* Failing to correctly track dependencies when a dependency file is referenced
  in an import statement, before the file is actually created in the file system.

* Failing to correctly track dependencies when e.g a prefix or file name extension
  is added or removed in either the file name or the import statement.

You have to be able to trust your build system to stay sane, and thats why this 
plugin was developed - to make sure all of those things were handled correctly.
That said, if you do find any issues, please report them in the issue tracker :-)