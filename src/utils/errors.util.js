"use strict";
exports.__esModule = true;
exports.getErrorMessage = void 0;
function getErrorMessage(error) {
    if (error instanceof Error)
        return error.message;
    return String(error);
}
exports.getErrorMessage = getErrorMessage;
