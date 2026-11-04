// Isolate every git call in the test run from the developer's global and system config
// (hooksPath, commit signing, templates) so results are the same on any machine.
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';
