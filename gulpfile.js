var gulp = require('gulp'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    del = require('del'),
    jshint = require('gulp-jshint'),
    jasmine = require('gulp-jasmine'),
    merge = require('merge-stream');

gulp.task('compile', function() {
    var min = gulp.src('src/tcmptappy.js')
        .pipe(uglify())
        .pipe(rename("tcmptappy.min.js"))
        .pipe(gulp.dest('dist'));
    
    var std = gulp.src('src/tcmptappy.js')
        .pipe(rename("tcmptappy.js"))
        .pipe(gulp.dest('dist'));

    return merge(min,std);
});

gulp.task('clean',function() {
    return del(['dist/**/*']);
});

gulp.task('lint',function() {
    return gulp.src('src/**/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('jshint-stylish'))
        .pipe(jshint.reporter('fail'));
});

gulp.task('test:lint',function() {
    return gulp.src('test/**/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('jshint-stylish'))
        .pipe(jshint.reporter('fail'));
});

gulp.task('test:run',function() {
    return gulp.src('test/**/*.js')
        .pipe(jasmine({
            includeStackTrace: true
        }));
});

gulp.task('test', gulp.series('test:lint','test:run'));

gulp.task('build',gulp.series(gulp.parallel('lint','clean'),'test','compile'));

gulp.task('watch',function() {
    gulp.watch(['src/**/*'],gulp.series('build'));
    gulp.watch(['test/**/*.js'],gulp.series('test'));
});

gulp.task('default',gulp.parallel('build','watch'));
