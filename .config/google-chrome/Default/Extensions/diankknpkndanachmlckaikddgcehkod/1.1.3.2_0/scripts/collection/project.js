define(function(require,exports){var a=require("configs/settings");exports.Collection=Backbone.Collection.extend({model:require("model/project").Model,url:function(){return a.API_HOST+"/projects"}})});