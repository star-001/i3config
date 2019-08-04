'use strict';(function(e){e(CodeMirror)})(function(e){var r=[void 0,"CodeMirror-bookmarks","CodeMirror-linenumbers"],l=e.Pos,t=e.Range,u=function(){var b=document.createElement("div");b.setAttribute("class","CodeMirror-bookmarks-marked");b.innerHTML="&nbsp;";return b},n=function(b,a,d){if(-1!=r.indexOf(d)){var c;(c=b.listSelections().filter(function(a){return!a.empty()}))&&0===c.length&&(c=[new t(new l(a,0),new l(a,b.getLine(a).length))]);v(b,c)}},p=function(b,a,d){for(var c,f,e,h=0;h<a.length;h++){c=
a[h].from();for(var k=a[h].to(),g=c.line;g<=k.line;++g)g<=k.line&&(c=l(g,0),e=(e=b.lineInfo(c))&&(f=e.gutterMarkers)&&f["CodeMirror-bookmarks"],d!==e&&b.setGutterMarker(c.line,"CodeMirror-bookmarks",d?u():null))}},q=function(b,a){var d=b.clipPos(a);return d.line==a.line&&d.ch==a.ch?a:null};e.defineOption("bookmarkGutter",!1,function(b,a){if(a)b.on("gutterClick",n);else b.off("gutterClick",n)});var w=function(b,a,d){p(b,[a],!0);return{clear:function(){p(b,[a],!1);d&&d.clear&&d.clear()},find:function(){var c=
a.from(),d=a.to();return q(b,c)&&q(b,d)?{from:c,to:d}:null},extra:d}};e.commands.nextBookmark=function(b){var a=b.state.bookmarks;if(a)for(;a.length;){var d=a.shift(),c=d.find();if(c)return a.push(d),b.setSelection(c.from,c.to)}};e.commands.prevBookmark=function(b){var a=b.state.bookmarks;if(a)for(;a.length;){a.unshift(a.pop());var d=a[a.length-1].find();if(d)return b.setSelection(d.from,d.to);a.pop()}};var v=e.commands.toggleBookmark=function(b,a,d){var c=b.state.bookmarks||(b.state.bookmarks=[]);
a=a||b.listSelections();void 0===d&&a.every(function(a){a:{var c,f=a.from();a=a.to();for(f=f.line;f<=a.line;++f)if(f<=a.line&&(c=new l(f,0),(c=b.lineInfo(c))&&c.gutterMarkers)){a=!0;break a}a=void 0}return d=!a});for(var f=0;f<a.length;f++){for(var e=a[f].from(),h=a[f].to(),k=b.findMarks(l(e.line,0),l(h.line,b.getLine(h.line).length+1)),g=0;g<k.length;g++)if(k[g].bookmark){for(var m=0;m<c.length;m++)c[m].extra==k[g]&&(c[m].clear(),c.splice(m--,1));break}d&&g==k.length&&c.push(w(b,a[f],b.markText(e,
h,{bookmark:!0,clearWhenEmpty:!1})))}};e.commands.clearBookmarks=function(b){if(b=b.state.bookmarks)for(var a=0;a<b.length;a++)b[a].clear();b.length=0};e.commands.selectBookmarks=function(b){var a=b.state.bookmarks,d=[];if(a)for(var c=0;c<a.length;c++){var f=a[c].find();f?d.push({anchor:f.from,head:f.to}):a.splice(c--,0)}d.length&&b.setSelections(d,0)}});
(function(e){e(CodeMirror)})(function(e){var r=[void 0,"CodeMirror-bookmarks","CodeMirror-linenumbers"],l=e.Pos,t=e.Range,u=function(){var b=document.createElement("div");b.setAttribute("class","CodeMirror-bookmarks-marked");b.innerHTML="&nbsp;";return b},n=function(b,a,d){if(-1!=r.indexOf(d)){var c;(c=b.listSelections().filter(function(a){return!a.empty()}))&&0===c.length&&(c=[new t(new l(a,0),new l(a,b.getLine(a).length))]);v(b,c)}},p=function(b,a,d){for(var c,f,e,h=0;h<a.length;h++){c=a[h].from();
for(var k=a[h].to(),g=c.line;g<=k.line;++g)g<=k.line&&(c=l(g,0),e=(e=b.lineInfo(c))&&(f=e.gutterMarkers)&&f["CodeMirror-bookmarks"],d!==e&&b.setGutterMarker(c.line,"CodeMirror-bookmarks",d?u():null))}},q=function(b,a){var d=b.clipPos(a);return d.line==a.line&&d.ch==a.ch?a:null};e.defineOption("bookmarkGutter",!1,function(b,a){if(a)b.on("gutterClick",n);else b.off("gutterClick",n)});var w=function(b,a,d){p(b,[a],!0);return{clear:function(){p(b,[a],!1);d&&d.clear&&d.clear()},find:function(){var c=a.from(),
d=a.to();return q(b,c)&&q(b,d)?{from:c,to:d}:null},extra:d}};e.commands.nextBookmark=function(b){var a=b.state.bookmarks;if(a)for(;a.length;){var d=a.shift(),c=d.find();if(c)return a.push(d),b.setSelection(c.from,c.to)}};e.commands.prevBookmark=function(b){var a=b.state.bookmarks;if(a)for(;a.length;){a.unshift(a.pop());var d=a[a.length-1].find();if(d)return b.setSelection(d.from,d.to);a.pop()}};var v=e.commands.toggleBookmark=function(b,a,d){var c=b.state.bookmarks||(b.state.bookmarks=[]);a=a||b.listSelections();
void 0===d&&a.every(function(a){a:{var c,e=a.from();a=a.to();for(e=e.line;e<=a.line;++e)if(e<=a.line&&(c=new l(e,0),(c=b.lineInfo(c))&&c.gutterMarkers)){a=!0;break a}a=void 0}return d=!a});for(var e=0;e<a.length;e++){for(var n=a[e].from(),h=a[e].to(),k=b.findMarks(l(n.line,0),l(h.line,b.getLine(h.line).length+1)),g=0;g<k.length;g++)if(k[g].bookmark){for(var m=0;m<c.length;m++)c[m].extra==k[g]&&(c[m].clear(),c.splice(m--,1));break}d&&g==k.length&&c.push(w(b,a[e],b.markText(n,h,{bookmark:!0,clearWhenEmpty:!1})))}};
e.commands.clearBookmarks=function(b){if(b=b.state.bookmarks)for(var a=0;a<b.length;a++)b[a].clear();b.length=0};e.commands.selectBookmarks=function(b){var a=b.state.bookmarks,d=[];if(a)for(var c=0;c<a.length;c++){var e=a[c].find();e?d.push({anchor:e.from,head:e.to}):a.splice(c--,0)}d.length&&b.setSelections(d,0)}});