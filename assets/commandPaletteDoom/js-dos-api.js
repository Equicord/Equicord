/*!
 * jQLite JavaScript Library v1.1.1 (http://code.google.com/p/jqlite/)
 * Copyright (c) 2010 Brett Fattori (bfattori@gmail.com)
 * Licensed under the MIT license
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Many thanks to the jQuery team's efforts.  Some code is
 * Copyright (c) 2010, John Resig.  See
 * http://jquery.org/license
 *
 * @author Brett Fattori (bfattori@gmail.com)
 * @author $Author: bfattori $
 * @version $Revision: 145 $
 *
 * Created: 03/29/2010
 * Modified: $Date: 2010-06-21 11:08:14 -0400 (Mon, 21 Jun 2010) $
 */
(function(){function B(){return+new Date}var D=function(a,b){if(a===""&&b)return b;var d=a.split(" "),c=d.shift(),e;if(c.charAt(0)=="#"){var g=i.getElementById(c.substring(1));e=g?[g]:[]}else{e=c.charAt(0)!=="."?c.split(".")[0]:"*";var h=c.split("."),j=null;if(e.indexOf("[")!=-1){j=e;e=e.substr(0,e.indexOf("["))}g=function(o){var n=arguments.callee,k;if(!(k=!n.needClass)){k=n.classes;if(o.className.length==0)k=false;else{for(var r=o.className.split(" "),l=k.length,p=0;p<k.length;p++)f.inArray(k[p],
r)!=-1&&l--;k=l==0}}if(k=k){if(!(k=!n.needAttribute)){n=n.attributes;k=true;for(r=0;r<n.length;r++){l=n[r].split("=");p=l[0].indexOf("!")!=-1||l[0].indexOf("*")!=-1?l[0].charAt(l[0].length-1)+"=":"=";if(p!="=")l[0]=l[0].substring(0,l[0].length-1);switch(p){case "=":k&=o.getAttribute(l[0])===l[1];break;case "!=":k&=o.getAttribute(l[0])!==l[1];break;case "*=":k&=o.getAttribute(l[0]).indexOf(l[1])!=-1;break;default:k=false}}k=k}k=k}if(k)return o};for(var u=[],s=0;s<b.length;s++)for(var C=b[s].getElementsByTagName(e),
v=0;v<C.length;v++)u.push(C[v]);h&&h.shift();e=[];g.classes=h;if(j!=null){var w=j.indexOf("[");s=j.lastIndexOf("]");w=j.substring(w+1,s).split("][")}g.attributes=j!=null?w:null;g.needClass=c.indexOf(".")!=-1&&h.length>0;g.needAttribute=j!=null;for(c=0;c<u.length;c++)g(u[c])&&e.push(u[c])}return D(d.join(" "),e)},Q=function(a,b){b=b||i;if(a.nodeType&&a.nodeType===E){a=i.body;if(a===null)return[i]}if(a.nodeType&&a.nodeType===m)return[a];if(a.jquery&&typeof a.jquery==="string")return a.toArray();if(b)b=
F(b);if(f.isArray(a))return a;else if(typeof a==="string"){for(var d=[],c=0;c<b.length;c++){var e=[b[c]];if(!f.forceSimpleSelectorEngine&&e[0].querySelectorAll){e=e[0].querySelectorAll(a);for(var g=0;g<e.length;g++)d.push(e.item(g))}else d=d.concat(D(a,e))}return d}else return null},G=false;setTimeout(function(){var a=i.body;if(a){var b=i.createElement("script"),d="i"+(new Date).getTime();b.type="text/javascript";try{b.appendChild(i.createTextNode("window."+d+"=1;"))}catch(c){}a.insertBefore(b,a.firstChild);
var e=true;if(window[d])delete window[d];else e=false;a.removeChild(b);G=e}else setTimeout(arguments.callee,33)},33);var H=function(a){var b=i.createElement("div");b.innerHTML=a;return{scripts:b.getElementsByTagName("script"),data:a}},I=function(a){a=a.replace(/-/g," ");a=a;var b=true;b=b||false;a=!a?"":a.toString().replace(/^\s*|\s*$/g,"");var d="";if(a.length<=0)a="";else{var c=false;d+=b?a.charAt(0):a.charAt(0).toUpperCase();for(b=1;b<a.length;b++){d+=c?a.charAt(b).toUpperCase():a.charAt(b).toLowerCase();
var e=a.charCodeAt(b);c=e==32||e==45||e==46;if(e==99||e==67)if(a.charCodeAt(b-1)==77||a.charCodeAt(b-1)==109)c=true}a=d}return a.replace(/ /g,"")},J={click:"MouseEvents",dblclick:"MouseEvents",mousedown:"MouseEvents",mouseup:"MouseEvents",mouseover:"MouseEvents",mousemove:"MouseEvents",mouseout:"MouseEvents",contextmenu:"MouseEvents",keypress:"KeyEvents",keydown:"KeyEvents",keyup:"KeyEvents",load:"HTMLEvents",unload:"HTMLEvents",abort:"HTMLEvents",error:"HTMLEvents",resize:"HTMLEvents",scroll:"HTMLEvents",
select:"HTMLEvents",change:"HTMLEvents",submit:"HTMLEvents",reset:"HTMLEvents",focus:"HTMLEvents",blur:"HTMLEvents",touchstart:"MouseEvents",touchend:"MouseEvents",touchmove:"MouseEvents"},K=function(a,b,d){if(f.isFunction(d)){if(typeof b==="string")b=b.toLowerCase();var c=J[b];if(b.indexOf("on")==0)b=b.substring(2);if(c){c=function(e){var g=arguments.callee,h=e.data||[];h.unshift(e);g=g.fn.apply(a,h);if(typeof g!="undefined"&&g===false){if(e.preventDefault&&e.stopPropagation){e.preventDefault();
e.stopPropagation()}else{e.returnValue=false;e.cancelBubble=true}return false}return true};c.fn=d;a.addEventListener?a.addEventListener(b,c,false):a.attachEvent("on"+b,c)}else{if(!a._handlers)a._handlers={};c=a._handlers[b]||[];c.push(d);a._handlers[b]=c}}},f=function(a,b){return(new x).init(a,b)},i=window.document,y=Object.prototype.hasOwnProperty,z=Object.prototype.toString,L=Array.prototype.push,R=Array.prototype.slice,m=1,E=9,A=[],M=false,N=false,q;f.forceSimpleSelectorEngine=false;f.each=function(a,
b){var d,c=0,e=a.length;if(e===undefined||f.isFunction(a))for(d in a){if(b.call(a[d],d,a[d])===false)break}else for(d=a[0];c<e&&b.call(d,c,d)!==false;d=a[++c]);return a};f.noop=function(){};f.isFunction=function(a){return z.call(a)==="[object Function]"};f.isArray=function(a){return z.call(a)==="[object Array]"};f.isPlainObject=function(a){if(!a||z.call(a)!=="[object Object]"||a.nodeType||a.setInterval)return false;if(a.constructor&&!y.call(a,"constructor")&&!y.call(a.constructor.prototype,"isPrototypeOf"))return false;
var b;for(b in a);return b===undefined||y.call(a,b)};f.merge=function(a,b){var d=a.length,c=0;if(typeof b.length==="number")for(var e=b.length;c<e;c++)a[d++]=b[c];else for(;b[c]!==undefined;)a[d++]=b[c++];a.length=d;return a};f.param=function(a){var b="";a&&f.each(a,function(d,c){b+=(b.length!=0?"&":"")+c+"="+encodeURIComponent(d)});return b};f.evalScripts=function(a){for(var b=i.getElementsByTagName("head")[0]||i.documentElement,d=0;d<a.length;d++){var c=i.createElement("script");c.type="text/javascript";
if(G)c.appendChild(i.createTextNode(a[d].text));else c.text=a[d].text;b.insertBefore(c,b.firstChild);b.removeChild(c)}};f.ready=function(){for(M=true;A.length>0;)A.shift()()};var t="jQuery"+B(),S=0,O={};f.noData={embed:true,object:true,applet:true};f.cache={};f.data=function(a,b,d){if(!(a.nodeName&&jQuery.noData[a.nodeName.toLowerCase()])){a=a==window?O:a;var c=a[t];c||(c=a[t]=++S);if(b&&!jQuery.cache[c])jQuery.cache[c]={};if(d!==undefined)jQuery.cache[c][b]=d;return b?jQuery.cache[c][b]:c}};f.removeData=
function(a,b){a=a==window?O:a;var d=a[t];if(b){if(jQuery.cache[d]){delete jQuery.cache[d][b];b="";for(b in jQuery.cache[d])break;b||jQuery.removeData(a)}}else{try{delete a[t]}catch(c){a.removeAttribute&&a.removeAttribute(t)}delete jQuery.cache[d]}};f.ajax={status:-1,statusText:"",responseText:null,responseXML:null,send:function(a,b,d){if(f.isFunction(b)){d=b;b={}}if(a){var c=true,e=null,g=null;if(typeof b.async!=="undefined"){c=b.async;delete b.async}if(typeof b.username!=="undefined"){e=b.username;
delete b.username}if(typeof b.password!=="undefined"){g=b.password;delete b.password}b=f.param(b);if(b.length!=0)a+=(a.indexOf("?")==-1?"?":"&")+b;b=new XMLHttpRequest;b.open("GET",a,c,e,g);b.send();if(c){a=function(h){var j=arguments.callee;h.status==200?f.ajax.complete(h,j.cb):f.ajax.error(h,j.cb)};a.cb=d;d=function(){var h=arguments.callee;h.req.readyState!=4?setTimeout(h,250):h.xcb(h.req)};d.req=b;d.xcb=a;setTimeout(d,250)}}},complete:function(a,b){f.ajax.status=a.status;f.ajax.responseText=a.responseText;
f.ajax.responseXML=a.responseXML;f.isFunction(b)&&b(a.responseText,a.status)},error:function(a,b){f.ajax.status=a.status;f.ajax.statusText=a.statusText;f.isFunction(b)&&b(a.status,a.statusText)}};f.makeArray=function(a,b){var d=b||[];if(a!=null)a.length==null||typeof a==="string"||jQuery.isFunction(a)||typeof a!=="function"&&a.setInterval?L.call(d,a):f.merge(d,a);return d};f.inArray=function(a,b){for(var d=0;d<b.length;d++)if(b[d]===a)return d;return-1};f.trim=function(a){return a!=null?a.toString().replace(/^\s*|\s*$/g,
""):""};var x=function(){};x.prototype={selector:"",context:null,length:0,jquery:"jqlite-1.1.1",init:function(a,b){if(!a)return this;if(a.nodeType){this.context=this[0]=a;this.length=1}else if(typeof a==="function")this.ready(a);else{var d=[];if(a.jquery&&typeof a.jquery==="string")d=a.toArray();else if(f.isArray(a))d=a;else if(typeof a==="string"&&f.trim(a).indexOf("<")==0&&f.trim(a).indexOf(">")!=-1){d=f.trim(a).toLowerCase();d=d.indexOf("<option")==0?"SELECT":d.indexOf("<li")==0?"UL":d.indexOf("<tr")==
0?"TBODY":d.indexOf("<td")==0?"TR":"DIV";d=i.createElement(d);d.innerHTML=a;d=[d.removeChild(d.firstChild)]}else{if(a.indexOf(",")!=-1){d=a.split(",");for(var c=0;c<d.length;c++)d[c]=f.trim(d[c])}else d=[a];c=[];for(var e=0;e<d.length;e++)c=c.concat(Q(d[e],b));d=c}L.apply(this,d)}return this},each:function(a){return f.each(this,a)},size:function(){return this.length},toArray:function(){return R.call(this,0)},ready:function(a){if(M)a();else{A.push(a);return this}},data:function(a,b){if(typeof a===
"undefined"&&this.length)return jQuery.data(this[0]);else if(typeof a==="object")return this.each(function(){jQuery.data(this,a)});var d=a.split(".");d[1]=d[1]?"."+d[1]:"";if(b===undefined){if(data===undefined&&this.length)data=jQuery.data(this[0],a);return data===undefined&&d[1]?this.data(d[0]):data}else return this.each(function(){jQuery.data(this,a,b)})},removeData:function(a){return this.each(function(){jQuery.removeData(this,a)})},addClass:function(a){return this.each(function(){if(this.className.length!=
0){var b=this.className.split(" ");if(f.inArray(a,b)==-1){b.push(a);this.className=b.join(" ")}}else this.className=a})},removeClass:function(a){return this.each(function(){if(this.className.length!=0){var b=this.className.split(" "),d=f.inArray(a,b);if(d!=-1){b.splice(d,1);this.className=b.join(" ")}}})},hasClass:function(a){if(this[0].className.length==0)return false;return f.inArray(a,this[0].className.split(" "))!=-1},isElementName:function(a){return this[0].nodeName.toLowerCase()===a.toLowerCase()},
toggleClass:function(a){return this.each(function(){if(this.className.length==0)this.className=a;else{var b=this.className.split(" "),d=f.inArray(a,b);d!=-1?b.splice(d,1):b.push(a);this.className=b.join(" ")}})},hide:function(a){return this.each(function(){if(this.style&&this.style.display!=null)if(this.style.display.toString()!="none"){this._oldDisplay=this.style.display.toString()||(this.nodeName!="span"?"block":"inline");this.style.display="none"}f.isFunction(a)&&a(this)})},show:function(a){return this.each(function(){this.style.display=
(this._oldDisplay&&this._oldDisplay!=""?this._oldDisplay:null)||(this.nodeName!="span"?"block":"inline");f.isFunction(a)&&a(this)})},css:function(a,b){if(typeof a==="string"&&b==null)return this[0].style[I(a)];else{a=typeof a==="string"?P(a,b):a;return this.each(function(){var d=this;typeof d.style!="undefined"&&f.each(a,function(c,e){e=typeof e==="number"?e+"px":e;var g=I(c);d.style[g]||(g=c);d.style[g]=e})})}},load:function(a,b,d){if(f.isFunction(b)){d=b;b={}}return this.each(function(){var c=function(e,
g){var h=arguments.callee;if(e){var j=H(e);h.elem.innerHTML=j.data;f.evalScripts(j.scripts)}f.isFunction(h.cback)&&h.cback(e,g)};c.cback=d;c.elem=this;f.ajax.send(a,b,c)})},html:function(a){return a?this.each(function(){var b=H(a);this.innerHTML=b.data;f.evalScripts(b.scripts)}):this[0].innerHTML},attr:function(a,b){return typeof a==="string"&&b==null?this[0]?this[0].getAttribute(a):"":this.each(function(){a=typeof a==="string"?P(a,b):a;for(var d in a)this.setAttribute(d,a[d])})},eq:function(a){var b=
this.toArray();this.context=this[0]=a<0?b[b.length+a]:b[a];this.length=1;return this},first:function(){this.context=this[0]=this.toArray()[0];this.length=1;return this},last:function(){var a=this.toArray();this.context=this[0]=a[a.length-1];this.length=1;return this},index:function(a){var b=-1;if(this.length!=0){var d=this[0];if(a){var c=f(a)[0];this.each(function(g){if(this===c){b=g;return false}})}else{a=this.parent()[0].firstChild;for(var e=[];a!=null;){a.nodeType===m&&e.push(a);a=a.nextSibling}f.each(a,
function(g){if(this===d){b=g;return false}})}}return b},next:function(a){var b=[];if(a){var d=f(a);this.each(function(){for(var c=this.nextSibling;c!=null&&c.nodeType!==m;)c=c.nextSibling;if(c!=null){var e=false;d.each(function(){if(this==c){e=true;return false}});e&&b.push(c)}})}else this.each(function(){for(var c=this.nextSibling;c!=null&&c.nodeType!==m;)c=c.nextSibling;c!=null&&b.push(c)});return f(b)},prev:function(a){var b=[];if(a){var d=f(a);this.each(function(){for(var c=this.previousSibling;c!=
null&&c.nodeType!==m;)c=c.previousSibling;if(c!=null){var e=false;d.each(function(){if(this==c){e=true;return false}});e&&b.push(c)}})}else this.each(function(){for(var c=this.previousSibling;c!=null&&c.nodeType!==m;)c=c.previousSibling;c!=null&&b.push(c)});return f(b)},parent:function(a){var b=[];if(a){var d=f(a);this.each(function(){var c=this.parentNode,e=false;d.each(function(){if(this==c){e=true;return false}});e&&b.push(c)})}else this.each(function(){b.push(this.parentNode)});return f(b)},parents:function(a){var b=
[];if(a){var d=f(a);this.each(function(){for(var c=this;c!=i.body;){d.each(function(){this==c&&b.push(c)});c=c.parentNode}})}else this.each(function(){for(var c=this;c!=i.body;){c=c.parentNode;b.push(c)}});return f(b)},children:function(a){var b=[];if(a){var d=f(a);this.each(function(){for(var c=this.firstChild;c!=null;){c.nodeType==m&&d.each(function(){this===c&&b.push(c)});c=c.nextSibling}})}else this.each(function(){for(var c=this.firstChild;c!=null;){c.nodeType==m&&b.push(c);c=c.nextSibling}});
return f(b)},append:function(a){a=F(a);return this.each(function(){for(var b=0;b<a.length;b++)this.appendChild(a[b])})},remove:function(a){return this.each(function(){a?$(a,this).remove():this.parentNode.removeChild(this)})},empty:function(){return this.each(function(){this.innerHTML=""})},val:function(a){if(a==null){var b=null;if(this&&this.length!=0&&typeof this[0].value!="undefined")b=this[0].value;return b}else return this.each(function(){if(typeof this.value!="undefined")this.value=a})},bind:function(a,
b){return this.each(function(){K(this,a,b)})},trigger:function(a,b){return this.each(function(){var d;var c;c=a;if(typeof c==="string")c=c.toLowerCase();var e=null,g=J[c]||"Event";if(i.createEvent){e=i.createEvent(g);e._eventClass=g;c&&e.initEvent(c,true,true)}if(i.createEventObject){e=i.createEventObject();if(c){e.type=c;e._eventClass=g}}c=e;if(c._eventClass!=="Event"){c.data=b;d=this.dispatchEvent(c)}else if(e=(this._handlers||{})[a])for(g=0;g<e.length;g++){var h=f.isArray(b)?b:[];h.unshift(c);
h=e[g].apply(this,h);if(!(typeof h=="undefined"?true:h))break}return d})},submit:function(a){return this.each(function(){if(f.isFunction(a))K(this,"onsubmit",a);else this.submit&&this.submit()})}};if(i.addEventListener)q=function(){i.removeEventListener("DOMContentLoaded",q,false);f.ready()};else if(i.attachEvent)q=function(){if(i.readyState==="complete"){i.detachEvent("onreadystatechange",q);f.ready()}};if(!N){N=true;if(i.readyState==="complete")return f.ready();if(i.addEventListener){i.addEventListener("DOMContentLoaded",
q,false);window.addEventListener("load",f.ready,false)}else if(i.attachEvent){i.attachEvent("onreadystatechange",q);window.attachEvent("onload",f.ready)}}var P=function(a,b){var d={};d[a]=b;return d},F=function(a){if(a.nodeType&&(a.nodeType===m||a.nodeType===E))a=[a];else if(typeof a==="string")a=f(a).toArray();else if(a.jquery&&typeof a.jquery==="string")a=a.toArray();return a};if(typeof window.jQuery=="undefined"){window.jQuery=f;window.jQuery.fn=x.prototype;window.$=window.jQuery;window.now=B}jQuery.extend=
jQuery.fn.extend=function(){var a=arguments[0]||{},b=1,d=arguments.length,c=false,e,g,h,j;if(typeof a==="boolean"){c=a;a=arguments[1]||{};b=2}if(typeof a!=="object"&&!jQuery.isFunction(a))a={};if(d===b){a=this;--b}for(;b<d;b++)if((e=arguments[b])!=null)for(g in e){h=a[g];j=e[g];if(a!==j)if(c&&j&&(jQuery.isPlainObject(j)||jQuery.isArray(j))){h=h&&(jQuery.isPlainObject(h)||jQuery.isArray(h))?h:jQuery.isArray(j)?[]:{};a[g]=jQuery.extend(c,h,j)}else if(j!==undefined)a[g]=j}return a};jQuery.each("click,dblclick,mouseover,mouseout,mousedown,mouseup,keydown,keypress,keyup,focus,blur,change,select,error,load,unload,scroll,resize,touchstart,touchend,touchmove".split(","),
function(a,b){jQuery.fn[b]=function(d){return d?this.bind(b,d):this.trigger(b)}})})();
(function() {
  this.Dosbox = (function() {
    function Dosbox(options) {
      this.onload = options.onload;
      this.onrun = options.onrun;
      this.ui = new Dosbox.UI(options);
      this.module = new Dosbox.Module({
        canvas: this.ui.canvas
      });
      this.ui.onStart((function(_this) {
        return function() {
          _this.ui.showLoader();
          return _this.downloadScript();
        };
      })(this));
    }

    Dosbox.prototype.run = function(archiveUrl, executable) {
      return new Dosbox.Mount(this.module, archiveUrl, {
        success: (function(_this) {
          return function() {
            var func, hide;
            _this.ui.updateMessage("Launching " + executable);
            hide = function() {
              return _this.ui.hideLoader();
            };
            func = function() {
              return _this._dosbox_main(_this, executable);
            };
            setTimeout(func, 1000);
            return setTimeout(hide, 3000);
          };
        })(this),
        progress: (function(_this) {
          return function(total, current) {
            return _this.ui.updateMessage("Mount " + executable + " (" + (current * 100 / total | 0) + "%)");
          };
        })(this)
      });
    };

    Dosbox.prototype.requestFullScreen = function() {
      if (this.module.requestFullScreen) {
        return this.module.requestFullScreen(true, false);
      }
    };

    Dosbox.prototype.downloadScript = function() {
      this.module.setStatus('Downloading js-dos');
      this.ui.updateMessage('Downloading js-dos');
      return new Dosbox.Xhr('https://thedoggybrad.github.io/doom_on_js-dos/js-dos-v3.js', {
        success: (function(_this) {
          return function(script) {
            var func;
            _this.ui.updateMessage('Initializing dosbox');
            func = function() {
              return _this._jsdos_init(_this.module, script, _this.onload);
            };
            return setTimeout(func, 1000);
          };
        })(this),
        progress: (function(_this) {
          return function(total, current) {
            return _this.ui.updateMessage("Downloading js-dos (" + (current * 100 / total | 0) + "%)");
          };
        })(this)
      });
    };

    Dosbox.prototype._jsdos_init = function(module, script, onload) {
      var Module;
      Module = module;
      eval(script);
      if (onload) {
        return onload(this);
      }
    };

    Dosbox.prototype._dosbox_main = function(dosbox, executable) {
      var exception, func;
      try {
        if (dosbox.onrun) {
          func = function() {
            return dosbox.onrun(dosbox, executable);
          };
          setTimeout(func, 1000);
        }
        return dosbox.module.ccall('dosbox_main', 'int', ['string'], [executable]);
      } catch (error) {
        exception = error;
        if (exception === 'SimulateInfiniteLoop') {

        } else {
          return typeof console !== "undefined" && console !== null ? typeof console.error === "function" ? console.error(exception) : void 0 : void 0;
        }
      }
    };

    return Dosbox;

  })();

}).call(this);

(function() {
  Dosbox.Module = (function() {
    function Module(options) {
      this.elCanvas = options.canvas;
      this.canvas = this.elCanvas[0];
    }

    Module.prototype.preRun = [];

    Module.prototype.postRun = [];

    Module.prototype.totalDependencies = 0;

    Module.prototype.print = function(text) {
      text = Array.prototype.slice.call(arguments).join(' ');
      return typeof console !== "undefined" && console !== null ? typeof console.log === "function" ? console.log(text) : void 0 : void 0;
    };

    Module.prototype.printErr = function(text) {
      text = Array.prototype.slice.call(arguments).join(' ');
      return typeof console !== "undefined" && console !== null ? typeof console.error === "function" ? console.error(text) : void 0 : void 0;
    };

    Module.prototype.setStatus = function(text) {
      return typeof console !== "undefined" && console !== null ? typeof console.log === "function" ? console.log(text) : void 0 : void 0;
    };

    Module.prototype.monitorRunDependencies = function(left) {
      var status;
      this.totalDependencies = Math.max(this.totalDependencies, left);
      status = left ? "Preparing... (" + (this.totalDependencies - left) + "/" + this.totalDependencies + ")" : 'All downloads complete.';
      return this.setStatus(status);
    };

    return Module;

  })();

}).call(this);

(function() {
  Dosbox.Mount = (function() {
    function Mount(module, url, options) {
      this.module = module;
      new Dosbox.Xhr(url, {
        success: (function(_this) {
          return function(data) {
            var bytes;
            bytes = _this._toArray(data);
            if (_this._mountZip(bytes)) {
              return options.success();
            } else {
              return typeof console !== "undefined" && console !== null ? typeof console.error === "function" ? console.error('Unable to mount', url) : void 0 : void 0;
            }
          };
        })(this),
        progress: options.progress
      });
    }

    Mount.prototype._mountZip = function(bytes) {
      var buffer, extracted;
      buffer = this.module._malloc(bytes.length);
      this.module.HEAPU8.set(bytes, buffer);
      extracted = this.module.ccall('extract_zip', 'int', ['number', 'number'], [buffer, bytes.length]);
      this.module._free(buffer);
      return extracted === 0;
    };

    Mount.prototype._toArray = function(data) {
      var arr, i, len;
      if (typeof data === 'string') {
        arr = new Array(data.length);
        i = 0;
        len = data.length;
        while (i < len) {
          arr[i] = data.charCodeAt(i);
          ++i;
        }
        return arr;
      }
      return data;
    };

    return Mount;

  })();

}).call(this);

(function() {
  Dosbox.UI = (function() {
    function UI(options) {
      this.appendCss();
      this.div = $('#' + (options.id || 'dosbox'));
      this.wrapper = $('<div class="dosbox-container">');
      this.canvas = $('<canvas class="dosbox-canvas" oncontextmenu="event.preventDefault()">');
      this.overlay = $('<div class="dosbox-overlay">');
      this.loaderMessage = $('<div class="dosbox-loader-message">');
      this.loader = $('<div class="dosbox-loader">').append($('<div class="st-loader">').append($('<span class="equal">'))).append(this.loaderMessage);
      this.start = $('<div class="dosbox-start">Click to start');
      this.div.append(this.wrapper);
      this.wrapper.append(this.canvas);
      this.wrapper.append(this.loader);
      this.wrapper.append(this.overlay);
      this.overlay.append(this.start);
    }

    UI.prototype.onStart = function(fun) {
      return this.start.click((function(_this) {
        return function() {
          fun();
          return _this.overlay.hide();
        };
      })(this));
    };

    UI.prototype.appendCss = function() {
      var head, style;
      head = document.head || document.getElementsByTagName('head')[0];
      style = document.createElement('style');
      style.type = 'text/css';
      if (style.styleSheet) {
        style.styleSheet.cssText = this.css;
      } else {
        style.appendChild(document.createTextNode(this.css));
      }
      return head.appendChild(style);
    };

    UI.prototype.showLoader = function() {
      this.loader.show();
      return this.loaderMessage.html('');
    };

    UI.prototype.updateMessage = function(message) {
      return this.loaderMessage.html(message);
    };

    UI.prototype.hideLoader = function() {
      return this.loader.hide();
    };

    UI.prototype.css = '.dosbox-container { position: relative; min-width: 320px; min-height: 200px; } .dosbox-canvas { } .dosbox-overlay, .dosbox-loader { position: absolute; left: 0; right: 0; top: 0; bottom: 0; background-color: #333; } .dosbox-start { text-align: center; position: absolute; left: 0; right: 0; bottom: 50%; color: #f80; font-size: 1.5em; text-decoration: underline; cursor: pointer; } .dosbox-overlay a { color: #f80; } .dosbox-loader { display: none; } .dosbox-powered { position: absolute; right: 1em; bottom: 1em; font-size: 0.8em; color: #9C9C9C; } .dosbox-loader-message { text-align: center; position: absolute; left: 0; right: 0; bottom: 50%; margin: 0 0 -3em 0; box-sizing: border-box; color: #f80; font-size: 1.5em; } @-moz-keyframes loading { 0% { left: 0; } 50% { left: 8.33333em; } 100% { left: 0; } } @-webkit-keyframes loading { 0% { left: 0; } 50% { left: 8.33333em; } 100% { left: 0; } } @keyframes loading { 0% { left: 0; } 50% { left: 8.33333em; } 100% { left: 0; } } .st-loader { width: 10em; height: 2.5em; position: absolute; top: 50%; left: 50%; margin: -1.25em 0 0 -5em; box-sizing: border-box; } .st-loader:before, .st-loader:after { content: ""; display: block; position: absolute; top: 0; bottom: 0; width: 1.25em; box-sizing: border-box; border: 0.25em solid #f80; } .st-loader:before { left: -0.76923em; border-right: 0; } .st-loader:after { right: -0.76923em; border-left: 0; } .st-loader .equal { display: block; position: absolute; top: 50%; margin-top: -0.5em; left: 4.16667em; height: 1em; width: 1.66667em; border: 0.25em solid #f80; box-sizing: border-box; border-width: 0.25em 0; -moz-animation: loading 1.5s infinite ease-in-out; -webkit-animation: loading 1.5s infinite ease-in-out; animation: loading 1.5s infinite ease-in-out; }';

    return UI;

  })();

}).call(this);

(function() {
  Dosbox.Xhr = (function() {
    function Xhr(url, options) {
      var e;
      this.success = options.success;
      this.progress = options.progress;
      if (window.ActiveXObject) {
        try {
          this.xhr = new ActiveXObject('Microsoft.XMLHTTP');
        } catch (error) {
          e = error;
          this.xhr = null;
        }
      } else {
        this.xhr = new XMLHttpRequest();
      }
      this.xhr.open('GET', url, true);
      this.xhr.overrideMimeType('text/plain; charset=x-user-defined');
      this.xhr.addEventListener('progress', (function(_this) {
        return function(evt) {
          if (_this.progress) {
            return _this.progress(evt.total, evt.loaded);
          }
        };
      })(this));
      this.xhr.onreadystatechange = (function(_this) {
        return function() {
          return _this._onReadyStateChange();
        };
      })(this);
      this.xhr.send();
    }

    Xhr.prototype._onReadyStateChange = function() {
      if (this.xhr.readyState === 4 && this.success) {
        return this.success(this.xhr.responseText);
      }
    };

    return Xhr;

  })();

}).call(this);
