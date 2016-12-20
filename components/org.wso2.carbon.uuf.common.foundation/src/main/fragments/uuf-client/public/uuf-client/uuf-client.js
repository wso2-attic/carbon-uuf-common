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
        throw new UUFClientException("JQuery is required for UUFClient.", "JQuery not available.");
    }
    // Check whether the Handlebars is available.
    if (!window.Handlebars) {
        throw new UUFClientException("Handlebars is required for UUFClient.", "Handlebars not available.");
    }

    /**
     * Indicates an error in UUFClient.
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
     * Creates a map from the zones defined in the comments.
     */
    function generateZonesMap() {
        zonesMap = {};
        $("*").contents().filter(function () {
            // For HTML comments, node type will be 8.
            return this.nodeType === 8;
        }).each(function (i, node) {
            var commentText = node.nodeValue;
            console.log("commentText: " + commentText);
            if (commentText.startsWith(UUF_ZONE_COMMENT_PREFIX)) {
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
            }
        });
        console.log("zonesMap: " + zonesMap);
    }

    /**
     * Inserts the content to the zone using the mode.
     * @param {string} content content to be inserted
     * @param {string} zone zone to be used
     * @param {string} mode mode to be used. This can be one of the PREPEND, APPEND, OVERWRITE values. PREPEND will
     * add the fragment to the beginning of the zone. APPEND will add the fragment to the end of the zone. OVERWRITE
     * will remove all of the content within the zone start and end comments and will add the content to the zone.
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
                throw new UUFClientException("Mode '" + mode + "' is not supported.");
        }
    }

    /**
     * Check the zoneName and mode variables for null or empty.
     * @param {string} zoneName
     * @param {string} mode
     */
    function checkNullOrEmpty(zoneName, mode) {
        if (!zoneName) {
            throw new UUFClientException("Zone name cannot be null or empty.");
        }
        if (!mode) {
            throw new UUFClientException("Mode cannot be null or empty.");
        }
    }

    /**
     * Render and insert the fragment to the given zone using the given mode.
     * @param {string} fragmentFullyQualifiedName Fully qualified name of the fragment
     * @param {Object} templateFillingObject data for the template
     * @param {string} zoneName zone to be used
     * @param {string} mode mode to be used. This can be one of the PREPEND, APPEND, OVERWRITE values. PREPEND will
     * add the fragment to the beginning of the zone. APPEND will add the fragment to the end of the zone. OVERWRITE
     * will remove all of the content within the zone start and end comments and will add the content to the zone.
     */
    UUFClient.renderFragment = function (fragmentFullyQualifiedName, templateFillingObject, zoneName, mode) {
        if (!fragmentFullyQualifiedName) {
            throw new UUFClientException("Fragment name cannot be null or empty.");
        }
        checkNullOrEmpty(zoneName, mode);

        if (!zonesMap) {
            generateZonesMap();
        }
        var zone = zonesMap[zoneName];
        if (!zone) {
            throw new UUFClientException("Zone '" + zoneName + "' does not exists in current DOM.");
        }

        var url = contextPath + "/fragments/" + fragmentFullyQualifiedName;
        $.ajax({
                   url: url,
                   type: "GET",
                   data: templateFillingObject,
                   success: function (data, textStatus, jqXHR) {
                       pushContent(data, zone, mode);
                   },
                   error: function (jqXHR, textStatus, errorThrown) {
                       throw new UUFClientException("Error occurred while retrieving fragment '"
                                                    + fragmentFullyQualifiedName + "' from '" + url
                                                    + "'.", errorThrown, jqXHR.status);
                   }
               });
    };

    /**
     * Get the embedded handlebars template from the page and render it using the data and insert it into
     * the zone using the mode.
     * @param {string} templateId id of the handlebars template
     * @param {Object} templateFillingObject data for the template
     * @param {string} zoneName zone to be used
     * @param {string} mode mode to be used. This can be one of the PREPEND, APPEND, OVERWRITE values. PREPEND will
     * add the fragment to the beginning of the zone. APPEND will add the fragment to the end of the zone. OVERWRITE
     * will remove all of the content within the zone start and end comments and will add the content to the zone.
     */
    UUFClient.renderTemplate = function (templateId, templateFillingObject, zoneName, mode) {
        if (!templateId) {
            throw new UUFClientException("Template name cannot be null or empty.");
        }
        checkNullOrEmpty(zoneName, mode);

        var source = $("#" + templateId).html();
        if (source) {
            UUFClient.renderTemplateString(source, templateFillingObject, zoneName, mode);
        } else {
            throw new UUFClientException("Template '" + templateId + "' not found");
        }
    };

    /**
     * Get the handlebars template from the given url and render it using the data and insert it into
     * the zone using the mode.
     * @param {string} templateUrl url of the template
     * @param {object} [templateFillingObject] data for the template
     * @param {string} zoneName zone to be used
     * @param {string} mode mode to be used. This can be one of the PREPEND, APPEND, OVERWRITE values. PREPEND will
     * add the fragment to the beginning of the zone. APPEND will add the fragment to the end of the zone. OVERWRITE
     * will remove all of the content within the zone start and end comments and will add the content to the zone.
     */
    UUFClient.renderTemplateUrl = function (templateUrl, templateFillingObject, zoneName, mode) {
        if (!templateUrl) {
            throw new UUFClientException("Template url cannot be null or empty.");
        }
        checkNullOrEmpty(zoneName, mode);

        $.ajax({
                   url: templateUrl,
                   type: "GET",
                   success: function (data, textStatus, jqXHR) {
                       var contentType = jqXHR.getResponseHeader("content-type") || "";
                       if (contentType.indexOf('text/x-handlebars-template') <= -1) {
                           throw new UUFClientException(
                               "Incorrect content type received. Expected: text/x-handlebars-template,"
                               + " Received: " + jqXHR.getResponseHeader("content-type"));
                       }
                       UUFClient.renderTemplateString(data, templateFillingObject, zoneName, mode)
                   },
                   error: function (jqXHR, textStatus, errorThrown) {
                       throw new UUFClientException(
                           "Error occurred while retrieving template from " + templateUrl
                           + ".", errorThrown, jqXHR.status);
                   }
               });
    };

    /**
     * Render the handlebars template using the data and insert it into the zone.
     * @param {string} templateString handlebars template
     * @param {Object} [templateFillingObject] data for the template
     * @param {string} zoneName zone to be used
     * @param {string} mode mode to be used. This can be one of the PREPEND, APPEND, OVERWRITE values. PREPEND will
     * add the fragment to the beginning of the zone. APPEND will add the fragment to the end of the zone. OVERWRITE
     * will remove all of the content within the zone start and end comments and will add the content to the zone.
     */
    UUFClient.renderTemplateString = function (templateString, templateFillingObject, zoneName, mode) {
        if (!templateString) {
            throw new UUFClientException("Template string cannot be null or empty.");
        }
        checkNullOrEmpty(zoneName, mode);

        if (!zonesMap) {
            generateZonesMap();
        }
        var zone = zonesMap[zoneName];
        if (!zone) {
            throw new UUFClientException("Zone '" + zoneName + "' does not exists in current DOM.");
        }

        try {
            var template = Handlebars.compile(templateString);
            pushContent(template(templateFillingObject), zone, mode);
        } catch (e) {
            throw new UUFClientException("Error occurred while compiling the handlebar template.", e);
        }
    };

})(UUFClient);
