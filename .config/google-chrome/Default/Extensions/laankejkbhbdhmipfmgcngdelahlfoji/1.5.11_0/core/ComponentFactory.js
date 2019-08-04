define(function(){var e={},t={};return{initAPI:function(e){e.mixin("Component",{load:this.load.bind(this),get:this.get.bind(this),getAll:this.getAll.bind(this),getClass:this.getClass.bind(this),getClasses:this.getClasses.bind(this)})},load:function(t){var n=t.name,o=t.instance||this.createInstanceID(t.name),i=t.view||null,r="function"==typeof t.onLoaded?t.onLoaded:null;try{var c=this.get(n,o);"function"==typeof r&&r(c)}catch(t){if(e[n]){var l=this.instantiate(e[n],o);"function"==typeof r&&r(l)}else this.require(n,o,i,r)}},require:function(t,n,o,i){var r=this,c="components/"+t+"/",l=o?"views/"+o+"/"+t+API.Utils.firstToUpper(o)+"View":t+"View",a=c+t+"Controller";require(["core/Component",a],function(o,a){var s="undefined"!=typeof a.prototype.collection,f=[c+t+"Model",c+l];s&&f.push(c+t+"Collection"),require(f,function(c,l,s){e[t]=new o(t,{Controller:a,Model:c,View:l,Collection:s});var f=r.instantiate(e[t],n);"function"==typeof i&&i(f)})})},instantiate:function(e,n){var o=e.name,i=e.create("Controller",n),r=e.create("Model",n),c=e.create("View",n),l=null,a="undefined"!=typeof i.collection;return a&&(l=e.create("Collection",n),i.collection=l,c.collection=l),i.model=r,i.view=c,c.model=r,"function"==typeof i.initAPI&&i.initAPI(API),t[o]="object"==typeof t[o]&&null!==t[o]?t[o]:{},t[o][n]={controller:i,model:r,view:c,collection:l},t[o][n]},get:function(e,n){if(!e)throw new Error("[ComponentFactory.get()] Must specify component name");if(!(e in t))throw new Error("[ComponentFactory.get()] "+e+" component has not been loaded yet");if(!(n in t[e]))throw new Error("[ComponentFactory.get()] "+n+" instance of "+e+" component has not been loaded yet");return t[e][n]},getAll:function(e){if(!e)throw new Error("[ComponentFactory.getAll()] Must specify component componentName");if(!(e in t))throw new Error("[ComponentFactory.getAll()] "+e+" component has not been loaded yet");return t[e]},getClass:function(t,n){if(!t)throw new Error("[ComponentFactory.get()] Must specify component name");if(!(t in e))throw new Error("[ComponentFactory.get()] "+t+" component has not been loaded yet");return e[t][n]},getClasses:function(t){if(!t)throw new Error("[ComponentFactory.get()] Must specify component name");if(!(t in e))throw new Error("[ComponentFactory.get()] "+t+" component has not been loaded yet");return e[t]},createInstanceID:function(e){return API.Utils.firstToLower(e)+"-"+(new Date).getTime()}}});