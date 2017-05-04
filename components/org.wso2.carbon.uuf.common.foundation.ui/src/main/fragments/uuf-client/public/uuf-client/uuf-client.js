/**
 * @license
 * Copyright (c) 2016, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

var UUFClient = {};

(function (UUFClient) {

    var UUF_ZONE_COMMENT_PREFIX = "[UUF-ZONE]";
    var HTML_HEAD_ELEMENT = $('head');
    var HTML_BODY_ELEMENT = $('body');

    var CALLBACK_ON_SUCCESS = "onSuccess";
    var CALLBACK_ON_FAILURE = "onFailure";

    var MODE_APPEND = "APPEND";
    var MODE_PREPEND = "PREPEND";
    var MODE_OVERWRITE = "OVERWRITE";

    /**
     * Zones in the current DOM.
     * @type {{string: {start: Object, end: Object}}}
     */
    var zonesMap;

    /**
     * Array of rendered fragment names.
     * @type {string[]} Array of fragments fully qualified names
     */
    var renderedFragments = [];

    // Check whether the JQuery is available.
    if (!window.jQuery) {
        throw new UUFClientException("JQuery is required for UUFClient.");
    }
    // Check whether the Handlebars is available.
    if (!window.Handlebars) {
        throw new UUFClientException("Handlebars JS is required for UUFClient.");
    }

    /**
     * Indicates an error in UUFClient.
     *
     * @param {string} message message of this error
     * @param {Object} [cause] cause of this error
     * @param {number} [statusCode] status code of this error
     * @constructor
     */
    function UUFClientException(message, cause, statusCode) {
        this.message = message;
        this.cause = cause;
        this.statusCode = statusCode;
    }

    /**
     * Populates a zones map by scanning HTML comments in the DOM.
     */
    function populateZonesMap() {
        zonesMap = {};
        $("*").contents().filter(function () {
            // For HTML comments, node type will be 8.
            return this.nodeType === 8;
        }).each(function (i, node) {
            var commentText = node.nodeValue;
            if (!commentText.startsWith(UUF_ZONE_COMMENT_PREFIX)) {
                return;
            }

            var zone;
            try {
                zone = JSON.parse(commentText.substring(UUF_ZONE_COMMENT_PREFIX.length));
            } catch (e) {
                throw new UUFClientException("Cannot parse UUFClient zone comment '" + commentText
                                             + "' as a JSON.");
            }
            if (!zone.name) {
                throw new UUFClientException("Cannot find field 'name' in the UUFClient zone comment '"
                                             + commentText + "'.");
            }
            if (!zone.position) {
                throw new UUFClientException("Cannot find field 'position' in the UUFClient zone comment '"
                                             + commentText + "'.");
            }

            if (!zonesMap[zone.name]) {
                zonesMap[zone.name] = {};
            }
            zonesMap[zone.name][zone.position] = node;
        });
    }

    /**
     * Update the HTML page content with JS and CSS returned by the fragment.
     *
     * @param {Object} data JSON object with HTML,CSS and JS
     * @param {string} fragmentFullyQualifiedName fully qualified name of the fragment
     */
    function updateResources(data, fragmentFullyQualifiedName) {
        if (renderedFragments.indexOf(fragmentFullyQualifiedName) == -1) {
            renderedFragments.push(fragmentFullyQualifiedName);
            if (data.css) {
                HTML_HEAD_ELEMENT.append(data.css);
            }
            if (data.headJs) {
                HTML_BODY_ELEMENT.append(data.headJs);
            }
            if (data.js) {
                HTML_BODY_ELEMENT.append(data.js);
            }
        }
    }

    /**
     * Pushes the content to the specified zone according to the given mode.
     *
     * @param {string} content content to push
     * @param {string} zone name of the zone to push
     * @param {string} mode mode to use. Mode can be either PREPEND, APPEND or OVERWRITE. PREPEND will
     *     add the fragment to the beginning of the existing content of that zone. Mode can be "PREPEND" (put the
     *     pushing content before the existing content), "APPEND" (put the pushing content after the existing content)
     *     or "OVERWRITE" (replace the existing content with the pushing content)
     */
    function pushContent(content, zone, mode) {
        if (!content) {
            console.warn("Content is empty.");
            return;
        }

        switch (mode) {
            case MODE_OVERWRITE:
                var innerContents = $(zone.start).parent().contents();
                innerContents.slice(innerContents.index($(zone.start)) + 1, innerContents.index($(zone.end))).remove();
                $(zone.start).after(content);
                break;
            case MODE_APPEND:
                $(zone.end).before(content);
                break;
            case MODE_PREPEND:
                $(zone.start).after(content);
                break;
        }
    }

    /**
     * Check the zoneName variable is null or empty.
     *
     * @param {?string} zoneName
     */
    function validateZoneName(zoneName) {
        if (!zoneName) {
            throw new UUFClientException("Zone name cannot be null or empty.");
        }
    }

    /**
     * Check the mode variable is null or empty.
     *
     * @param {?string} mode
     */
    function validateMode(mode) {
        if (!mode) {
            throw new UUFClientException("Mode cannot be null or empty.");
        }
        if (mode != MODE_APPEND && mode != MODE_PREPEND && mode != MODE_OVERWRITE) {
            throw new UUFClientException("Mode should be one of '" + MODE_APPEND + "," + MODE_PREPEND + ","
                                         + MODE_OVERWRITE + "'. Instead found '" + mode + "'.");
        }
    }


    /**
     * Check the callback functions.
     *
     * @param {?Object} callbacks
     */
    function validateCallback(callbacks) {
        if (!callbacks[CALLBACK_ON_SUCCESS]) {
            throw new UUFClientException("Function '" + CALLBACK_ON_SUCCESS + "' not found in callbacks.");
        }
        if (!callbacks[CALLBACK_ON_FAILURE]) {
            throw new UUFClientException("Function '" + CALLBACK_ON_FAILURE + "' not found in callbacks.");
        }
    }

    /**
     * Get the fragment the content from Ajax call and pushes to a given zone or callback.
     *
     * @param {string} fragmentFullyQualifiedName fully qualified name of the fragment
     * @param {?Object} templateFillingObject data for the template
     * @param {string} zone name of the zone to push
     * @param {string} mode mode to use
     * @param {Function} callbacks callback function
     *
     */
    function renderFragmentImpl(fragmentFullyQualifiedName, templateFillingObject, zone, mode, callbacks) {
        var url = contextPath + "/fragments/" + fragmentFullyQualifiedName;
        $.ajax({
                   url: url,
                   type: "POST",
                   contentType: 'application/json',
                   data: JSON.stringify(templateFillingObject),
                   success: function (data, textStatus, jqXHR) {
                       try {
                           if (zone && mode) {
                               pushContent(data.html, zone, mode);
                               updateResources(data, fragmentFullyQualifiedName);
                           }
                           callbacks[CALLBACK_ON_SUCCESS](data.html);
                       } catch (e) {
                           callbacks[CALLBACK_ON_FAILURE]("Error occurred while pushing the content.", e);
                       }
                   },
                   error: function (jqXHR, textStatus, errorThrown) {
                       var msg = "Error occurred while retrieving fragment '" + fragmentFullyQualifiedName
                                 + "' from '" + url + "'.";
                       callbacks[CALLBACK_ON_FAILURE](msg, errorThrown);
                   }
               });
    }

    /**
     * Renders the specified fragment and pushes to the given zone according to the given mode or provide rendered
     * HTML content to the success function of the given callback.
     *
     * @param {string} fragmentFullyQualifiedName fully qualified name of the fragment
     * @param {?Object} templateFillingObject data for the template
     * @param {string | Function} zoneNameOrCallbacks name of the zone to push or callback function
     * @param {string} mode mode to use
     * @param {Function} callbacks callback function
     */
    UUFClient.renderFragment =
        function (fragmentFullyQualifiedName, templateFillingObject, zoneNameOrCallbacks, mode, callbacks) {
            if (!fragmentFullyQualifiedName) {
                throw new UUFClientException("Fragment name cannot be null or empty.");
            }

            if (!mode && !callbacks) {
                callbacks = zoneNameOrCallbacks;
                validateCallback(callbacks);

                renderFragmentImpl(fragmentFullyQualifiedName, templateFillingObject, null, null, callbacks);
            } else {
                var zoneName = zoneNameOrCallbacks;
                validateZoneName(zoneName);
                validateMode(mode);
                validateCallback(callbacks);

                // This check is not done on renderTemplate* functions because this check will be done in pushContent
                // function.
                if (!zonesMap) {
                    populateZonesMap();
                }
                var zone = zonesMap[zoneName];
                if (!zone) {
                    throw new UUFClientException("Zone '" + zoneName + "' does not exists in current DOM.");
                }
                renderFragmentImpl(fragmentFullyQualifiedName, templateFillingObject, zone, mode, callbacks);
            }
        };

    /**
     * Renders the specified embedded Handlebars template and pushes to the given zone according to the given mode or
     * provide rendered HTML content to the success function of the given callback.
     *
     * @param {string} templateId id of the handlebars template
     * @param {?Object} templateFillingObject data for the template
     * @param {string | Function} zoneNameOrCallbacks name of the zone to push
     * @param {string} mode mode to use
     * @param {Function} callbacks callback function
     */
    UUFClient.renderTemplate = function (templateId, templateFillingObject, zoneNameOrCallbacks, mode, callbacks) {
        if (!templateId) {
            throw new UUFClientException("Template name cannot be null or empty.");
        }

        if (!mode && !callbacks) {
            callbacks = zoneNameOrCallbacks;
            validateCallback(callbacks);
            var source = $("#" + templateId).html();
            if (source) {
                UUFClient.renderTemplateString(source, templateFillingObject, callbacks, null, null);
            } else {
                throw new UUFClientException("Template '" + templateId + "' not found");
            }

        } else {
            var zoneName = zoneNameOrCallbacks;

            validateZoneName(zoneName);
            validateMode(mode);
            validateCallback(callbacks);
            var source = $("#" + templateId).html();
            if (source) {
                UUFClient.renderTemplateString(source, templateFillingObject, zoneName, mode, callbacks);
            } else {
                throw new UUFClientException("Template '" + templateId + "' not found");
            }
        }
    };

    /**
     * Retrieves the Handlebars template from the specified URL and renders and pushes it to the given zone according
     * to the given mode or provide rendered HTML content to the success function of the given callback.
     *
     * @param {string} templateUrl url of the template
     * @param {?Object} templateFillingObject data for the template
     * @param {string | Function} zoneNameOrCallbacks name of the zone to push
     * @param {string} mode mode to use
     * @param {Function} callbacks callback function
     */
    UUFClient.renderTemplateUrl = function (templateUrl, templateFillingObject, zoneNameOrCallbacks, mode, callbacks) {
        if (!templateUrl) {
            throw new UUFClientException("Template url cannot be null or empty.");
        }

        if (!mode && !callbacks) {
            callbacks = zoneNameOrCallbacks;
            validateCallback(callbacks);
            renderTemplateUrlImpl(templateUrl, templateFillingObject, null, null, callbacks);
        } else {
            var zoneName = zoneNameOrCallbacks;
            validateZoneName(zoneName);
            validateMode(mode);
            validateCallback(callbacks);

            renderTemplateUrlImpl(templateUrl, templateFillingObject, zoneName, mode, callbacks);
        }
    };

    /**
     * Renders the Handlebars template from the specified URL and pushes to the given zone according to the given mode
     * or provide rendered HTML content to the success function of the given callback.
     *
     * @param {string} templateUrl url of the template
     * @param {?Object} templateFillingObject data for the template
     * @param {string} zoneName name of the zone to push
     * @param {string} mode mode to use
     * @param {Function} callbacks callback function
     */
    function renderTemplateUrlImpl(templateUrl, templateFillingObject, zoneName, mode, callbacks) {
        $.ajax({
                   url: templateUrl,
                   type: "GET",
                   success: function (data, textStatus, jqXHR) {
                       var contentType = jqXHR.getResponseHeader("content-type") || "";
                       if (contentType.indexOf('text/x-handlebars-template') <= -1) {
                           throw new UUFClientException(
                               "Response content type is incorrect. Found '" + jqXHR.getResponseHeader("content-type")
                               + "' instead of 'text/x-handlebars-template'.");
                       }
                       if (!zoneName && !mode) {
                           UUFClient.renderTemplateString(data, templateFillingObject, zoneName, mode);
                       }
                       callbacks[CALLBACK_ON_SUCCESS](data);
                   },
                   error: function (jqXHR, textStatus, errorThrown) {
                       callbacks[CALLBACK_ON_FAILURE](
                           "Error occurred while retrieving template from " + templateUrl + ".",
                           errorThrown);
                   }
               });
    }

    /**
     * Renders the Handlebars template and pushes to the given zone according to the given mode
     * or provide rendered Handlebars template content to a given call back.
     *
     * @param {string} templateString Handlebars template
     * @param {?Object} templateFillingObject data for the template
     * @param {string} zone name of the zone to push
     * @param {string} mode mode to use
     * @param {Function} callbacks callback function
     */
    function renderTemplateStringImpl(templateString, templateFillingObject, zone, mode, callbacks) {
        try {
            var template = Handlebars.compile(templateString);
            var html = template(templateFillingObject);
            if (zone && mode) {
                pushContent(html, zone, mode);
            }
            callbacks[CALLBACK_ON_SUCCESS](html);
        } catch (e) {
            callbacks[CALLBACK_ON_FAILURE]("Error occurred while compiling the handlebar template.", e);
        }
    }

    /**
     * Renders the Handlebars template and pushes to the given zone according to the given mode or
     * provide rendered HTML content to the success function of the given callback.
     *
     * @param {string} templateString Handlebars template
     * @param {?Object} templateFillingObject data for the template
     * @param {string | Function} zoneNameOrCallbacks name of the zone to push
     * @param {string} mode mode to use
     * @param {Function} callbacks callback function
     */
    UUFClient.renderTemplateString =
        function (templateString, templateFillingObject, zoneNameOrCallbacks, mode, callbacks) {
            if (!templateString) {
                throw new UUFClientException("Template string cannot be null or empty.");
            }

            if (!mode && !callbacks) {
                callbacks = zoneNameOrCallbacks;
                validateCallback(callbacks);

                renderTemplateStringImpl(templateString, templateFillingObject, null, null, callbacks);
            } else {
                var zoneName = zoneNameOrCallbacks;
                validateZoneName(zoneName);
                validateMode(mode);
                validateCallback(callbacks);

                if (!zonesMap) {
                    populateZonesMap();
                }

                var zone = zonesMap[zoneName];
                if (!zone) {
                    throw new UUFClientException("Zone '" + zoneName + "' does not exists in current DOM.");
                }
                renderTemplateStringImpl(templateString, templateFillingObject, zone, mode, callbacks);
            }
        };

    /**
     * Returns the i18n message for the given key.
     * @param messageKey message key
     * @returns i18n message
     */
    UUFClient.i18n = function (messageKey) {
        // TODO: 5/4/17 implement i18n capability to UUFClient, until we just return the messageKey.
        return messageKey;
    };

})(UUFClient);
