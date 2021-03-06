'use strict';

const gulp = require('gulp');
const sequence = require('run-sequence');


let pkg = require('./package.json');
let banner = '/**\n * Copyright (c) ${new Date().getFullYear()} ${pkg.author}\n * All rights reserved.\n */\n';

let date = new Date().getTime();


gulp.task('default', function(done) {
	sequence('devel', 'watch', done);
});


gulp.task('build', function(done) {
	sequence('lint', 'clean', ['copy:assets', 'copy:templates', 'nunjucks', 'less', 'uglify'], 'snapshot', done);
});


gulp.task('bundle:frontend', function() {
	const path = require('path');

	const zip = require('gulp-zip');
	const rename = require('gulp-rename');

	let basename = path.basename(process.cwd());
	let renameExpression = new RegExp('^' + basename);

	return gulp.src([
		'src/**'
	], {
		base: 'src',
		nodir: true
	})
		.pipe(rename(function(path) {
			path.dirname = path.dirname.replace(renameExpression, pkg.name);

			return path;
		}))
		.pipe(zip(pkg.name + '-frontend-' + pkg.version + '.zip'))
		.pipe(gulp.dest('dist'));
});


gulp.task('bundle:backend', function() {
	const path = require('path');

	const zip = require('gulp-zip');
	const rename = require('gulp-rename');

	let basename = path.basename(process.cwd());
	let renameExpression = new RegExp('^' + basename);

	return gulp.src([
		'lib/**'
	], {
		base: 'lib',
		nodir: true
	})
		.pipe(rename(function(path) {
			path.dirname = path.dirname.replace(renameExpression, pkg.name);

			return path;
		}))
		.pipe(zip(pkg.name + '-backend-' + pkg.version + '.zip'))
		.pipe(gulp.dest('dist'));
});


gulp.task('clean', function() {
	const clean = require('gulp-clean');

	return gulp.src([
		'artifacts/',
		'dist/',
		'dump/'
	], {
		read: false
	})
		.pipe(clean({
			force: true
		}));
});


gulp.task('copy:assets', function() {
	return gulp.src([
		'static/**/*',
		'!static/**/*.js',
		'!static/**/*.less'
	], {
		nodir: true
	})
		.pipe(gulp.dest('artifacts/'));
});


gulp.task('copy:templates', function() {
	return gulp.src([
		'templates/**'
	])
		.pipe(gulp.dest('dist/static/' + date))
});


gulp.task('devel', function(done) {
	sequence('clean', ['copy:assets', 'copy:templates', 'less', 'uglify:devel'], done);
});


gulp.task('less', function() {
	const LessAutoPrefix = require('less-plugin-autoprefix');
	const cleanCSS = require('gulp-clean-css');
	const header = require('gulp-header');
	const less = require('gulp-less');
	const rename = require('gulp-rename');

	return gulp.src([
		'static/less/site.less'
	])
		.pipe(less({
			plugins: [
				new LessAutoPrefix({
					browsers: ['last 3 versions', 'ie 11', 'ie 10']
				})
			]
		}))
		.pipe(cleanCSS())
		.pipe(rename({
			extname: '.min.css'
		}))
		.pipe(header(banner, {
			pkg: pkg
		}))
		.pipe(gulp.dest('artifacts/css'));
});


gulp.task('lint', ['lint:js', 'lint:json']);


gulp.task('lint:js', function() {
	const eslint = require('gulp-eslint');

	return gulp.src([
		'*.js',
		'static/**/*.js',
		'src/**/*.js',
		'test/**/*.js',
		'!node_modules/**/*.js',
		'!src/node_modules/**/*.js',
		'!static/lib/**/*.js'
	])
		.pipe(eslint({
			configFile: 'eslint.json'
		}))
		.pipe(eslint.formatEach());
});


gulp.task('lint:json', function() {
	const jsonlint = require('gulp-jsonlint');

	return gulp.src([
		'*.json',
		'src/**/*.json',
		'fixtures/**/*.json'
	])
		.pipe(jsonlint())
		.pipe(jsonlint.failOnError())
		.pipe(jsonlint.reporter());
});


gulp.task('lint:less', function() {
	const lesshint = require('gulp-lesshint');

	return gulp.src([
		'static/**/*.less'
	])
		.pipe(lesshint())
		.pipe(lesshint.failOnError())
		.pipe(lesshint.reporter());
});


gulp.task('nunjucks', function() {
	const path = require('path');

	const concat = require('gulp-concat');
	const gutil = require('gulp-util');
	const header = require('gulp-header');
	const nunjucks = require('gulp-nunjucks');
	const rename = require('gulp-rename');
	const uglify = require('gulp-uglify');

	return gulp.src([
		'nunjucks/**/*.html'
	])
		.pipe(nunjucks.precompile({
			env: (function(nunjucks) {
				var environment;

				environment = new nunjucks.Environment();

				environment.addFilter('get', function() {});
				environment.addFilter('date', function() {});
				environment.addFilter('fileSize', function() {});

				return environment;
			})(require('nunjucks')),

			name: (function() {
				let delimiter, names;

				delimiter = 'nunjucks' + path.sep;
				names = {};

				return function(file) {
					let filename = file.path;
					let i = filename.indexOf(delimiter);
					let template = ~i ? filename.slice(i + delimiter.length) : template.replace(new RegExp(path.sep, 'g'), '/');

					if (names.hasOwnProperty(template)) {
						gutil.log('Name collison on nunjucks template "' + template + '":\n\tOld: ' + names[template] + '\n\tNew: ' + filename);
					}

					names[template] = filename;

					return template;
				};
			})()
		}))
		.pipe(concat('templates.js'))
		.pipe(uglify())
		.pipe(header(banner, {
			pkg: pkg
		}))
		.pipe(rename({
			extname: '.min.js'
		}))
		.pipe(gulp.dest('artifacts/js'));
});


gulp.task('snapshot', function() {
	return gulp.src([
		'artifacts/**'
	])
		.pipe(gulp.dest('dist/static/' + date));
});


gulp.task('uglify', function() {
	const addsrc = require('gulp-add-src');
	const babel = require('gulp-babel');
	const header = require('gulp-header');
	const rename = require('gulp-rename');
	const uglify = require('gulp-uglify');

	return gulp.src([
		'static/**/*.js',
		'!static/js/site2.js',
		'!static/lib/requirejs/**/*.js'
	])
		.pipe(babel({
			presets: ['es2015'],
			plugins: ['transform-es2015-modules-amd']
		}))
		.pipe(addsrc([
			'static/lib/requirejs/**/*.js'
		], {
			base: 'static'
		}))
		.pipe(uglify())
		.pipe(header(banner, {
			pkg: pkg
		}))
		.pipe(rename({
			extname: '.min.js'
		}))
		.pipe(gulp.dest('artifacts'));
});


gulp.task('uglify:devel', function() {
	const addsrc = require('gulp-add-src');
	const babel = require('gulp-babel');
	const rename = require('gulp-rename');

	return gulp.src([
		'static/**/*.js',
		'!static/lib/requirejs/**/*.js'
	])
		.pipe(babel({
			presets: ['es2015'],
			plugins: ['transform-es2015-modules-amd']
		}))
		.pipe(addsrc([
			'static/lib/requirejs/**/*.js'
		], {
			base: 'static'
		}))
		.pipe(rename({
			extname: '.min.js'
		}))
		.pipe(gulp.dest('artifacts'));
});


gulp.task('watch', function() {
	gulp.watch([
		'static/**/*.js'
	], ['uglify:devel'])
		.on('error', function() {
			this.emit('end');
		});

	gulp.watch([
		'static/**/*.less'
	], ['less'])
		.on('error', function() {
			this.emit('end');
		});
});
