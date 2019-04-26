// # Globbing (tip thanks to Yeoman)
// for performance reasons we're only matching one level down:
// 'test/spec/{,*/}*.js'
// use this if you want to match all subfolders:
// 'test/spec/**/*.js'

/* global module:false */
module.exports = (grunt) => {
  grunt.initConfig({
    mochacli: {
      options: {
        globals: ['should'],
        timeout: 3000,
        ignoreLeaks: false,
        ui: 'bdd',
        reporter: 'spec'
      },

      all: { src: 'test/{,*/}*.js' }
    },

    watch: {
      files: ['Gruntfile.js', 'lib/apimocker.js', 'test/{,*/}*.js'],
      tasks: ['eslint', 'test']
    },

    eslint: {
      all: ['Gruntfile.js', 'lib/apimocker.js', 'test/{,*/}*.js']
    }
  });

  grunt.loadNpmTasks('grunt-mocha-cli');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('gruntify-eslint');

  grunt.registerTask('test', ['mochacli']);

  grunt.registerTask('default', ['eslint', 'test']);
};
