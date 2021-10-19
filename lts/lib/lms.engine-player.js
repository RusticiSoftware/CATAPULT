/*
    Copyright 2021 Rustici Software

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/
const Wreck = require ("@hapi/wreck"),
    FormData = require ("form-data"),
    fs = require ("fs"),
    {InvalidPackageError} = require ("./errors"),
    _cleanup = {
        courses: [],
        registrations: []
    };

let _playerApi,
    playerTenantName,
    playerServer,
    playerConfigUrlTemplate,
    playerToken,
    playerApi,
    lrsEndpoint,
    lrsUsername,
    lrsPassword,
    nextRegistrationNumber = 1;

function fetchVarFromJS (name, jsCode)
{
    var ofs = jsCode.indexOf (name);
    ofs = jsCode.indexOf ("=", ofs);

    let script = jsCode.substring (ofs + 1, jsCode.indexOf (";", ofs)).replace (/\'/g, "\"");

    try {
        return JSON.parse (script);
    }
    catch (ex) {
        return null;
    }
}

module.exports = {
    setup: async (testName) => {
        const playerUsername = process.env.ENGINE_PLAYER_USERNAME,
            playerPassword = process.env.ENGINE_PLAYER_PASSWORD;

        const expireSeconds = 3600; // 1 hour
        const expireTs = new Date (new Date ().getTime () + expireSeconds * 1000);

        _playerApi = Wreck.defaults (
            {
                baseUrl: process.env.ENGINE_PLAYER_API_URL,
                headers: {
                    Authorization: `Basic ${Buffer.from (`${playerUsername}:${playerPassword}`).toString ("base64")}`
                },
                json: true
            }
        );

        playerTenantName = `lmsTestTenant-${testName}`;
        playerServer = process.env.ENGINE_PLAYER_SERVER;
        if (playerServer.endsWith ("/"))
        {
            // Take out the trailing '/'
            playerServer = playerServer.substring (0, playerServer.length);
        }

        playerConfigUrlTemplate = process.env.ENGINE_PLAYER_CONFIG_URL_TEMPLATE;

        try {
            const tenantResponse = await _playerApi.put (
                `appManagement/tenants/${playerTenantName}`,
                {
                    headers: {
                        "Content-Type": "application/json"
                    },
                    payload: JSON.stringify ({
                        "active": true
                    })
                }
            );
        }
        catch (ex) {
            console.log (ex);
            throw new Error (`Failed to create player tenant: ${ex}`);
        }

        try {
            const tokenResponse = await _playerApi.post (
                "appManagement/token",
                {
                    headers: {
                        "Content-Type": "application/json",
                        "engineTenantName": playerTenantName
                    },
                    payload: JSON.stringify ({
                        permissions: {
                            scopes: [
                                "write:registration",
                                "delete:registration",
                                "write:course",
                                "read:course",
                                "delete:course",
                                "write:player",
                                "read:player"
                            ]
                        },
                        expiry: expireTs.toISOString ()
                    })
                }
            );

            playerToken = tokenResponse.payload.result;
        }
        catch (ex) {
            console.log (ex);
            throw new Error (`Failed to retrieve player token: ${ex}`);
        }

        playerApi = Wreck.defaults (
            {
                baseUrl: process.env.ENGINE_PLAYER_API_URL,
                headers: {
                    Authorization: `Bearer ${playerToken}`
                },
                json: true
            }
        );

        lrsEndpoint = process.env.LRS_ENDPOINT;
        if (lrsEndpoint.endsWith ("/")) {
            lrsEndpoint = lrsEndpoint.substring (0, lrsEndpoint.length - 1);
        }
        lrsUsername = process.env.LRS_USERNAME;
        lrsPassword = process.env.LRS_PASSWORD;
    },

    teardown: async () => {
        try {
            await _playerApi.request ("DELETE", `appManagement/tenants/${playerTenantName}/data`);
            await _playerApi.request ("DELETE", `appManagement/tenants/${playerTenantName}`);
        }
        catch (ex) {
            console.log ("lms.catapult-player:teardown", ex);
        }
    },

    getLrsEndpoint: () => lrsEndpoint.replace (/TENANT_NAME/g, playerTenantName),

    getLrsAuthHeader: () => `Basic ${Buffer.from (`${lrsUsername}:${lrsPassword}`).toString ("base64")}`,

    importCourse: async (stream, contentType, filename) => {
        let importResult;

        let courseId = filename.replace (/[^A-Za-z0-9]/g, "");

        let foam = new FormData ();
        foam.append ("file", stream);

        let headers = foam.getHeaders ();
        headers.engineTenantName = playerTenantName;
        headers.uploadedContentType = contentType;

        try {
            importResult = await playerApi.post (
                "courses/upload?courseId=" + courseId + "&mayCreateNewVersion=true&dryRun=false",
                {
                    headers: headers,
                    payload: foam
                }
            );
        }
        catch (ex) {
            if (ex.isBoom) {
                let msg = ex.data.payload.message;
                var isPackageError = false;
                switch (msg)
                {
                    case "Error opening zip file":
                    case "Specified zip does not contain a manifest.":
                        isPackageError = true;
                        break;
                    default:
                    if (
                        msg.startsWith ("A contentType was provided; however, it is not a recognized media type.")
                    )
                    {
                        isPackageError = true;
                    }
                    else
                    {
                        console.log (ex.data.payload);
                    }
                }
                if (isPackageError) {
                    throw new InvalidPackageError (`Invalid package (cannot import): ${msg})`);
                }

                const err = ex.data.payload ? `${ex.data.payload.message} (${ex.data.payload.srcError}` : ex.data;

                throw new Error (`Failed import request: ${err})`);
            }

            throw new Error (`Failed LMS import of file: ${ex}`);
        }

        _cleanup.courses.push (importResult.payload.course.id);

        return importResult.payload.course.id;
    },

    getLaunchUrl: async (courseId, auIndex, actor, {registration, launchMode}) => {
        let registrationId;
        if (typeof (registration) == "string")
        {
            registrationId = registration;
        }
        else
        {
            registrationId = "registration_" + (nextRegistrationNumber++);
        }

        try {
            registrationResult = await playerApi.post (
                `registrations`,
                {
                    headers: {
                        engineTenantName: playerTenantName
                    },
                    payload: {
                        courseId: courseId,
                        learner: {
                            id: "learner-ltsTest01",
                            firstName: "Name",
                            lastName: "Surname"
                        },
                        registrationId: registrationId
                    }
                }
            );
            _cleanup.registrations.push (registrationId);
        }
        catch (ex) {
            throw new Error ("Failed to create registration");
        }

        let url = 
                playerConfigUrlTemplate
                    .replace ("TENANT_NAME", escape (playerTenantName))
                    .replace ("COURSE_ID", escape (courseId))
                    .replace ("VERSION_ID", "0")
                    .replace ("REGISTRATION_ID", escape (registrationId))
                    .replace ("INSTANCE_ID", "0");

        var jsText;
        try {
            configResult = await playerApi.get (url);
            jsText = configResult.payload.toString ();
        }
        catch (ex) {
            console.log (ex);
            throw new Error ("Failed to load course player configuration");
        }

        var jsStreamDebug = fs.createWriteStream (".PlayerConfig.js");
        jsStreamDebug.write (jsText);
        jsStreamDebug.close ();

        var launchTemplate = fetchVarFromJS ("cmi5LaunchTemplate", jsText);
        var aus = fetchVarFromJS ("cmi5Aus", jsText);
        var auList = [];
        for (var auIdentifier in aus)
        {
            auList.push (auIdentifier);
        }

        let auId = auList [auIndex];
        let homeUrl = actor.account.homePage;
        let auLaunchUrl = launchTemplate + "&auId=" + escape (auId) + "&returnURL=" + escape (homeUrl).replace (/\//g, "%2F");

        if (typeof (launchMode) == "string")
        {
            auLaunchUrl = auLaunchUrl.replace (/&forceReview=(true|false)/g, "")
                .replace (/&forceBrowse=(true|false)/g, "");
            if (launchMode == "Review")
            {
                auLaunchUrl += "&forceReview=true&forceBrowse=false";
            }
            else if (launchMode == "Browse")
            {
                auLaunchUrl += "&forceReview=false&forceBrowse=true";
            }
            else
            {
                auLaunchUrl += "&forceReview=false&forceBrowse=false";
            }
        }

        if (auLaunchUrl.startsWith ("/"))
        {
            auLaunchUrl = playerServer + auLaunchUrl;
        }

        var contentUrl = "";
        try {
            contentResult = await playerApi.get (auLaunchUrl);
            contentUrl = contentResult.res.headers.location;
        }
        catch (ex) {
            console.log (ex);
            throw new Error ("Failed to load course content URL");
        }

        return contentUrl;
    },

    cleanup: async () => {
        for (const registrationId of _cleanup.registrations) {
            try
            {
                await playerApi.delete (`registrations/${registrationId}`,
                {
                    headers: {
                        engineTenantName: playerTenantName
                    }
                });
            }
            catch (ex)
            {
                // Ignore HTTP 404 Not Found because it just means that
                // we don't have to delete it, that it didn't exist to
                // begin with. Although it would be worth looking into
                // why they don't exist. Something smells about this.
                if (ex.data.res.statusCode != 404)
                {
                    console.log ("Error deleting registration: " + ex);
                }
            }
        }
        for (const courseId of _cleanup.courses) {
            try
            {
                await playerApi.delete (`courses/${courseId}`,
                {
                    headers: {
                        engineTenantName: playerTenantName
                    }
                });
            }
            catch (ex)
            {
                // Ignore HTTP 404 Not Found because it just means that
                // we don't have to delete it, that it didn't exist to
                // begin with. Although it would be worth looking into
                // why they don't exist. Something smells about this.
                if (ex.data.res.statusCode != 404)
                {
                    console.log ("Error deleting course: " + ex);
                }
            }
        }
    },

    hasWaive: () => false,
    waiveAU: async (registration, auIndex, reason) => {
        throw new Error ("This is not implemented in Engine yet");
    },

    hasAbandon: () => false,
    abandonSession: async (sessionId) => {
        throw new Error ("This is not implemented in Engine yet");
    }
};


