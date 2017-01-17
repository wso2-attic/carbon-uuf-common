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

    /**
     * Zones in the current DOM.
     * @type {{string: {start: Object, end: Object}}}
     */

    var zonesMap;

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
     *
     * @returns {string} error error message if an error occurs
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
                return "Cannot parse UUFClient zone comment '" + commentText + "' as a JSON.";
            }
            if (!zone.name) {
                return "Cannot find field 'name' in the UUFClient zone comment '" + commentText + "'.";
            }
            if (!zone.position) {
                return "Cannot find field 'position' in the UUFClient zone comment '" + commentText + "'.";
            }

            if (!zonesMap[zone.name]) {
                zonesMap[zone.name] = {};
            }
            zonesMap[zone.name][zone.position] = node;
        });
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
     *
     * @returns {string} error error message if an error occurs
     */
    function pushContent(content, zone, mode) {
        if (!content) {
            console.warn("Content is empty.");
            return;
        }

        switch (mode) {
            case "OVERWRITE":
                var innerContents = $(zone.start).parent().contents();
                innerContents.slice(innerContents.index($(zone.start)) + 1, innerContents.index($(zone.end))).remove();
                $(zone.start).after(content);
                break;
            case "APPEND":
                $(zone.end).before(content);
                break;
            case "PREPEND":
                $(zone.start).after(content);
                break;
            default:
                return "Mode '" + mode + "' is not supported.";
        }
    }

    /**
     * Check the zoneName and mode variables for null or empty.
     *
     * @param {string} zoneName
     * @param {string} mode
     *
     * @returns {string} error error message if an error occurs
     */
    function checkNullOrEmpty(zoneName, mode) {
        if (!zoneName) {
            return "Zone name cannot be null or empty.";
        }
        if (!mode) {
            return "Mode cannot be null or empty.";
        }
    }

    /**
     * Renders the specified fragment and pushes to the given zone according to the given mode.
     *
     * @param {string} fragmentFullyQualifiedName fully qualified name of the fragment
     * @param {?Object} templateFillingObject data for the template
     * @param {string} zoneName name of the zone to push
     * @param {string} mode mode to use
     * @param {Function} callbacks callback function
     */
    UUFClient.renderFragment = function (fragmentFullyQualifiedName, templateFillingObject, zoneName, mode, callbacks) {
        if (!fragmentFullyQualifiedName) {
            throw new UUFClientException("Fragment name cannot be null or empty.");
        }
        checkNullOrEmpty(zoneName, mode);

        if (!zonesMap) {
            var error = populateZonesMap();
            if (error) {
                if (callbacks["onFailure"]) {
                    callbacks["onFailure"](error);
                }
                return;
            }
        }
        var zone = zonesMap[zoneName];
        if (!zone) {
            if (callbacks["onFailure"]) {
                callbacks["onFailure"]("Zone '" + zoneName + "' does not exists in current DOM.");
            }
            return;
        }

        var url = contextPath + "/fragments/" + fragmentFullyQualifiedName;
        $.ajax({
                   url: url,
                   type: "POST",
                   contentType: 'application/json',
                   data: JSON.stringify(templateFillingObject),
                   success: function (data, textStatus, jqXHR) {
                       var error = pushContent(data, zone, mode);
                       if (error) {
                           if (callbacks["onFailure"]) {
                               callbacks["onFailure"](error);
                           }
                           return;
                       }

                       if (callbacks["onSuccess"]) {
                           callbacks["onSuccess"](data);
                       }
                   },
                   error: function (jqXHR, textStatus, errorThrown) {
                       if (callbacks["onFailure"]) {
                           var msg = "Error occurred while retrieving fragment '" + fragmentFullyQualifiedName
                                     + "' from '" + url + "'.";
                           callbacks["onFailure"](msg, errorThrown);
                       }
                   }
               });
    };

    /**
     * Renders the specified embedded Handlebars template and pushes to the given zone according to the given mode.
     *
     * @param {string} templateId id of the handlebars template
     * @param {?Object} templateFillingObject data for the template
     * @param {string} zoneName name of the zone to push
     * @param {string} mode mode to use
     * @param {Function} callbacks callback function
     */
    UUFClient.renderTemplate = function (templateId, templateFillingObject, zoneName, mode, callbacks) {
        if (!templateId) {
            if (callbacks["onFailure"]) {
                callbacks["onFailure"]("Template name cannot be null or empty.");
            }
            return;
        }
        var error = checkNullOrEmpty(zoneName, mode);
        if (error) {
            if (callbacks["onFailure"]) {
                callbacks["onFailure"](error);
            }
            return;
        }

        var source = $("#" + templateId).html();
        if (source) {
            UUFClient.renderTemplateString(source, templateFillingObject, zoneName, mode, callbacks);
        } else {
            if (callbacks["onFailure"]) {
                callbacks["onFailure"]("Template '" + templateId + "' not found.");
            }
        }
    };

    /**
     * Retrieves the Handlebars template from the specified URL and renders and pushes it to the given zone according
     * to the given mode.
     *
     * @param {string} templateUrl url of the template
     * @param {?Object} templateFillingObject data for the template
     * @param {string} zoneName name of the zone to push
     * @param {string} mode mode to use
     * @param {Function} callbacks callback function
     */
    UUFClient.renderTemplateUrl = function (templateUrl, templateFillingObject, zoneName, mode, callbacks) {
        if (!templateUrl) {
            if (callbacks["onFailure"]) {
                callbacks["onFailure"]("Template url cannot be null or empty.");
            }
            return;
        }

        var error = checkNullOrEmpty(zoneName, mode);
        if (error) {
            if (callbacks["onFailure"]) {
                callbacks["onFailure"](error);
            }
            return;
        }

        $.ajax({
                   url: templateUrl,
                   type: "GET",
                   success: function (data, textStatus, jqXHR) {
                       var contentType = jqXHR.getResponseHeader("content-type") || "";
                       if (contentType.indexOf('text/x-handlebars-template') <= -1) {
                           if (callbacks["onFailure"]) {
                               callbacks["onFailure"](
                                   "Response content type is incorrect. Found '" + jqXHR.getResponseHeader(
                                       "content-type")
                                   + "' instead of 'text/x-handlebars-template'.");
                           }
                           return;
                       }
                       UUFClient.renderTemplateString(data, templateFillingObject, zoneName, mode);
                       if (callbacks["onSuccess"]) {
                           callbacks["onSuccess"](data);
                       }
                   },
                   error: function (jqXHR, textStatus, errorThrown) {
                       if (callbacks["onFailure"]) {
                           callbacks["onFailure"]("Error occurred while retrieving template from " + templateUrl
                                                  + ".", errorThrown);
                       }
                   }
               });
    };

    /**
     * Renders the Handlebars template and pushes to the given zone according to the given mode.
     *
     * @param {string} templateString Handlebars template
     * @param {?Object} templateFillingObject data for the template
     * @param {string} zoneName name of the zone to push
     * @param {string} mode mode to use
     * @param {Function} callbacks callback function
     */
    UUFClient.renderTemplateString = function (templateString, templateFillingObject, zoneName, mode, callbacks) {
        if (!templateString) {
            if (callbacks["onFailure"]) {
                callbacks["onFailure"]("Template string cannot be null or empty.");
            }
            return;
        }

        var error = checkNullOrEmpty(zoneName, mode, callbacks);
        if (error) {
            if (callbacks["onFailure"]) {
                callbacks["onFailure"](error);
            }
            return;
        }

        if (!zonesMap) {
            error = populateZonesMap();
            if (error) {
                if (callbacks["onFailure"]) {
                    callbacks["onFailure"](error);
                }
                return;
            }
        }

        var zone = zonesMap[zoneName];
        if (!zone) {
            if (callbacks["onFailure"]) {
                callbacks["onFailure"]("Zone '" + zoneName + "' does not exists in current DOM.");
            }
        }

        try {
            var template = Handlebars.compile(templateString);
            var html = template(templateFillingObject);
            pushContent(html, zone, mode);
            if (callbacks["onSuccess"]) {
                callbacks["onSuccess"](html);
            }
        } catch (e) {
            if (callbacks["onFailure"]) {
                callbacks["onFailure"]("Error occurred while compiling the handlebar template.", e);
            }
        }
    };

})(UUFClient);
