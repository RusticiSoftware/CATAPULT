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
import Helpers from "../lib/helpers";

const execute = async () => {
    const cmi5 = await Helpers.initCmi5();

    if (! cmi5) {
        return;
    }

    try {
        await cmi5.postFetch();
    }
    catch (ex) {
        Helpers.storeResult(false, true, {msg: `Failed to start AU at POSTing to the fetch URL: ${ex}`});

        return;
    }

    try {
        await cmi5.loadLMSLaunchData();
    }
    catch (ex) {
        Helpers.storeResult(false, true, {msg: `Failed to start AU at loading LMS Launch Data: ${ex}`});

        return;
    }

    try {
        await cmi5.loadLearnerPrefs();
    }
    catch (ex) {
        Helpers.storeResult(false, true, {msg: `Failed to start AU at loading Learner Prefs: ${ex}`});

        return;
    }

    // Do a full session in a single batch.
    const fullSession = [
        cmi5.initializedStatement(),
        cmi5.passedStatement(),
        cmi5.completedStatement(),
        cmi5.terminatedStatement()
    ];

    if (! await Helpers.sendStatement(cmi5, fullSession, "gav 123", {method: "post", shouldSucceed: true})) {
        return;
    }
    await Helpers.returnAU(cmi5);

    Helpers.storeResult(true, false, {msg: "Valid statement batch accepted."});
};

execute();
