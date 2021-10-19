# LMS Test Suite

## Building the Package Library

This test suite is a CLI Node.js application. Install the test suite dependencies in the `lts/` directory by doing:

    npm ci

Then build the LMS test packages by doing:

    cd pkg
    npx webpack

## Running Manually

The test suite itself can then be executed manually by following the [documented test procedure (procedure.md)](procedure.md) using an LMS user interface and the package library.

## Running Automatically

To run this suite automatically or via CI, create a `.env` file in the `CATAPULT/lts` directory and define the required environment variables. For example:

    # path to LMS script (required)
    CATAPULT_LMS="./lib/lms.engine-player.js"

    # values used by the script
    ENGINE_PLAYER_API_URL="http://Rustici-MacBook-Pro.local:8081/engine/api/v2/"
    ENGINE_PLAYER_USERNAME="apiuser"
    ENGINE_PLAYER_PASSWORD="password"
    ENGINE_PLAYER_SERVER="http://Rustici-MacBook-Pro.local:8081"
    ENGINE_PLAYER_CONFIG_URL_TEMPLATE="http://rustici-macbook-pro.local:8081/engine/PlayerConfiguration.jsp?configuration=TENANT_NAME&preventRightClick=false&cc=en_US&ieCompatibilityMode=none&package=ApiCourseId%7CCOURSE_ID%21VersionId%7CVERSION_ID&registration=ApiRegistrationId%7CREGISTRATION_ID%21InstanceId%7CINSTANCE_ID&tracking=true&forceReview=false&player=modern"

    LRS_ENDPOINT="http://Rustici-MacBook-Pro.local:8081/engine/lrs/TENANT_NAME"
    LRS_USERNAME="dev-tools-xapi"
    LRS_PASSWORD="dev-tools-xapi-password"

Note that `lms.engine-player.js` accepts placeholders in some of the environment variables. Particularly, the `ENGINE_PLAYER_CONFIG_URL_TEMPLATE` variable accepts the `TENANT_NAME`, `COURSE_ID`, `VERSION_ID`, `REGISTRATION_ID`, and `INSTANCE_ID` placeholders. The `LRS_ENDPOINT` variable, on the other hand, only accepts a `TENANT_NAME` placeholder. The placeholders are just uppercase names, and they do not need any dollar signs or any special formatting when used in the URL variables.

With those files in place the dependencies should be installed and then the tests can be run:

    npx jest

This will display the test output in the console and write a uniquely named JUnit formatted XML file to the `var/` directory.
