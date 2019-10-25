## Versions

#### 1.1.4
Update dependency versions.
#### 1.1.3
Fix for old node versions 6 & 7.
#### 1.1.2
Ability to specify mockBody instead of mockFile and provide it's content as response body.  See PR #95.  Thanks @thejonan !
Added body filtering based on raw body or provided hash. See PR #102.  Thanks @thejonan !
Upgrade dependencuy versions to remove vulnerabilities.  Thanks @kopach !
#### 1.1.1
Pretty colored logging.  Thanks @twalker !
#### 1.1.0
Support javascript config files.  Thanks @twalker !
Drop support for Node 5.  Add support for Node 9, 10.  Update to use more ES6 constructs.  Thanks @twalker !
#### 1.0.4
Switch to jsonpath from JSONPath.  (Fix for issue #97.)  Thanks @twalker !
Support file upload via multer.  Thanks @thejonan !
#### 1.0.3
Correctly read params from request path.  (Fix for issue #91.)
Thanks again @twalker !
#### 1.0.2
Updates to remove deprecated express functions. (Fix for issue #88.)  Thanks @ivank !
Fix URL decoding for mock file path.  Thanks @twalker !
#### 1.0.1
Support non-string values in templates.  Thanks again @ferrerod !
#### 1.0.0
Stop support for old node versions < 4.  Update dependency versions.  Thanks @kopach ! 
Add Parse server support.  Thanks @ipuiu !
Add jsonPathSwitchResponse to support return lists of objects from a single mock file.  Thanks @ketonal !
#### 0.5.1
Add option for CORS credentials.  Thanks @zeflq !
Allow HTTP status to be updated from /admin/setMock.  Thanks @jordanhamill !
#### 0.5.0
Fixed an issue causing httpStatus to be ignored.  Thanks @aleofreddi !
Add support for proxy intercept function.  Thanks @pgraham !
Switch to work on Node > 4.0.0.
#### 0.4.16
Fix to return 404 instead of 500, when no mockFile is found. Thanks @aburmeis !
When switch is used, a standard http status can be returned when there's no match, even without a base mockFile.
Add support for basepath.
#### 0.4.15
Improved templating, with the templateSwitch option.  Thanks @ferrerod !
#### 0.4.14
Upgrade version of express-http-proxy.  (Fix for issue #48.) Thanks @pgraham !
#### 0.4.12
Allow PATCH method in CORS middleware.  (Fix for issue #54.)  Also fixed some flaky tests.
#### 0.4.11
Added template feature, to insert values from request into the mock response.  Thanks @Samurai336 !
#### 0.4.10
Added express-xml-bodyparser, so that XML post requests can be use for RegExp switches.  Thanks @asnov !
#### 0.4.9
Added support for custom middleware functions.
#### 0.4.8
Added proxy option. Thanks @ztsmith !
#### 0.4.7
Added ability to switch using Regular Expression.  (See issue #2, #33, #34)  Thanks @dploeger !
#### 0.4.6
Added ability to switch on header param.  Thanks @stelio !
#### 0.4.5
Added support for alternate paths in a web service config. Added support for a callback function when starting the server.  Thanks @ztsmith !
#### 0.4.4
Added option to log request headers.  Thanks @dmeenhuis !
#### 0.4.3
Added support to run apimocker in Cloud Foundry.
#### 0.4.2
Added support for tilde (~) in mockDirectory config setting.
#### 0.4.0
Removed support for old deprecated config file format.  Fixed issue #19.
#### 0.3.5
Added support for additional custom HTTP headers.  Thanks to @jcstover !
#### 0.3.4
Added support for switching response based on complex JSON request, using JSONPath.  (see issue #14)  Thanks to @priyagampa !
#### 0.3.3
Added support for switching response HTTP status based on a request parameter.  (see issue #12)
#### 0.3.2
Added support for multiple switch parameters on a single URL.  Thanks @skjegg and @snyoz !
#### 0.3.1
Added support for a static path.  (see issue #9)
#### 0.3.0
Refactored and updated to use Express 4.5.  (No functional change.)
#### 0.2.4
Allows configuration of the "access-control-allow-headers" HTTP header.
#### 0.2.3
Now allows HTTP status code to be set for each response.  Config file format also allows configuration of different responses based on http verb.
#### 0.1.8
New "switch" feature added, allowing different responses based on a request parameter.
#### 0.1.6
New config file format was introduced, allowing for custom content-types and more fine grained control over services.