// () => ({ port: 1111 })

function x() {
    console.log('test-function-config.js called');
    return {port: 1111};
}

module.exports = x;