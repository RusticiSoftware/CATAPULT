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

    // Reject a double initialization within the same batch, leave as uninitialized.
    const doubleInitialize = [cmi5.initializedStatement(), cmi5.initializedStatement()];

    if (! await Helpers.sendStatement(cmi5, doubleInitialize, "9.3.0.0-2", {method: "post"})) {
        return;
    }

    await cmi5.initialize();

    // Reject a double termination within the same batch, leave as unterminated.
    const doubleTerminated = [cmi5.terminatedStatement(), cmi5.terminatedStatement()];

    if (! await Helpers.sendStatement(cmi5, doubleTerminated, "9.3.0.0-2", {method: "post"})) {
        return;
    }

    // Reject a double passed within the same batch.
    const doublePassed = [cmi5.passedStatement(), cmi5.passedStatement()];

    if (! await Helpers.sendStatement(cmi5, doublePassed, "9.3.0.0-2", {method: "post"})) {
        return;
    }

    // Reject a double failed within the same batch.
    const doubleFailed = [cmi5.failedStatement(), cmi5.failedStatement()];

    if (! await Helpers.sendStatement(cmi5, doubleFailed, "9.3.0.0-2", {method: "post"})) {
        return;
    }

    // Reject a passed and failed within the same batch, in either order
    const passedFailed = [cmi5.passedStatement(), cmi5.failedStatement()];

    if (! await Helpers.sendStatement(cmi5, passedFailed, "9.3.0.0-3", {method: "post"})) {
        return;
    }

    const failedPassed = [cmi5.failedStatement(), cmi5.passedStatement()];

    if (! await Helpers.sendStatement(cmi5, failedPassed, "9.3.0.0-3", {method: "post"})) {
        return;
    }

    // cmi5 defined statements should still be accepted.
    try {
        await cmi5.passed();
    }
    catch (ex) {
        Helpers.storeResult(false, true, {msg: `Failed call to passed: ${ex}`});

        return;
    }

    await Helpers.closeAU(cmi5);

    Helpers.storeResult(true, false, {msg: "All statement batches rejected successfully."});
};

execute();
