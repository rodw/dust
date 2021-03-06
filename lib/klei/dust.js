var dust = require('dustjs-linkedin'),
    fs = require('fs');
    pathlib = require('path');

var kleiDust = function () {
    var self = this,
        cache = {},
        isInitialized = false,
        settings = null;

    var getDefaultOptions = function () {
        return {
            root: null,
            extension: 'dust',
            relativeToFile: true,
            keepWhiteSpace: false,
            useHelpers: false,
            cache: false
        };
    };

    var initializeSettings = function () {
        if (!settings)
            self.resetOptions();
    };

    this.resetOptions = function () {
        settings = getDefaultOptions();
    };

    this.setOptions = function (options) {
        initializeSettings();

        if (typeof options.root !== 'undefined')
            settings.root = options.root;

        if (typeof options.extension !== 'undefined')
            settings.extension = options.extension;

        if (typeof options.cache !== 'undefined')
            settings.cache = !!options.cache;

        if (typeof options.relativeToFile !== 'undefined')
            settings.relativeToFile = !!options.relativeToFile;

        if (typeof options.keepWhiteSpace !== 'undefined')
            settings.keepWhiteSpace = !!options.keepWhiteSpace;

        if (typeof options.useHelpers !== 'undefined')
            settings.useHelpers = !!options.useHelpers;
    };

    this.getOptions = function () {
        initializeSettings();
        return settings;
    };

    this.getDust = function () {
        initializeDust();
        return dust;
    };

    this.setHelpers = function (helpers) {
        dust.helpers = helpers;
        return dust;
    };

    var fileExists = function (path) {
        try {
            fs.lstatSync(path);
        } catch (e) {
            return false;
        }
        return true;
    };

    this.pathIncludesExtension = function (path) {
        if (!self.getOptions().extension)
            return true;

        if (pathlib.extname(path) !== '')
            return true;

        return false;
    };

    this._doResolveRelativePath = function (locals) {
        return !!(self.getOptions().relativeToFile && locals && locals.filename);
    };

    this._doResolveExpressViewsPath = function (locals) {
        return !!(locals && locals.settings && locals.settings.views);
    };

    this._doResolveRootSettingPath = function () {
        return !!(self.getOptions().root);
    };

    this.getFullPath = function (path, locals) {
        if (this._doResolveRelativePath(locals))
            path = pathlib.resolve(pathlib.dirname(locals.filename), path);
        else if (this._doResolveRootSettingPath())
            path = pathlib.resolve(self.getOptions().root, path);
        else if (this._doResolveExpressViewsPath(locals))
            path = pathlib.resolve(locals.settings.views, path);

        if (fileExists(path))
            return path;

        if (!self.pathIncludesExtension(path))
            path += "." + self.getOptions().extension;

        return path;
    };

    var getCachedString = function (path) {
        if (!self.getOptions().cache) return;

        var str = cache[path];

        if (str && typeof str === 'string')
            return str;
    };

    var setCachedString = function (path, str) {
        if (!self.getOptions().cache) return;

        cache[path] = str;
    };

    var getCachedTemplate = function (path) {
        if (!self.getOptions().cache) return;

        var template = cache[path];

        if (template && typeof template === 'function')
            return template;
    };

    var setCachedTemplate = function (path, template) {
        if (!self.getOptions().cache) {
            dust.cache = {};
            return;
        }
        cache[path] = template;
    };

    var loadTemplate = function (path, locals, callback) {
        path = self.getFullPath(path, locals);

        var str = getCachedString(path);

        if (str) return callback(null, str);

        fs.readFile(path, 'utf8', function(err, str){
            if (err) return callback(err);

            setCachedString(path, str);

            callback(null, str);
        });
    };

    var disableWhiteSpaceCompression = function () {
        dust.optimizers.format = function(ctx, node) { return node; };
    };

    var loadHelpers = function () {
        self.setHelpers(require('dustjs-helpers').helpers);
    };

    var initializeDust = function (locals) {
        if (isInitialized)
            return;

        if (self.getOptions().keepWhiteSpace)
            disableWhiteSpaceCompression();

        if (self.getOptions().useHelpers)
            loadHelpers();

        dust.onLoad = function (path, callback) {
            loadTemplate(path, locals, callback);
        };
        isInitialized = true;
    };

    this.dust = function(path, locals, callback){
        initializeDust(locals);

        var template = getCachedTemplate(path);

        if (template) return template(locals, callback);

        loadTemplate(path, locals, function(err, str) {
            if (err) return callback(err);

            try {
                locals.filename = path;
                template = dust.compileFn(str);

                setCachedTemplate(path, template);

                template(locals, callback);
            } catch (err) {
                callback(err);
            }
        });
    };
};

module.exports = new kleiDust();
