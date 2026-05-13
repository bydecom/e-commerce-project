export default {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    collectCoverageFrom: [
        'src/modules/**/*.service.ts',
        '!src/**/*.d.ts'
    ],
    coverageThreshold: {
        global: { lines: 50 }
    },
};