const { repairJson, loads } = require('../src');

describe('logging seçeneği her zaman [değer, loglar] döndürmeli', () => {
    test('Bozuk JSON', () => {
        const [value, logs] = repairJson('{"a" 1}', { logging: true });
        expect(value).toEqual({ a: 1 });
        expect(Array.isArray(logs)).toBe(true);
        expect(logs[0]).toEqual({ text: 'Missing colon after key, adding it', context: expect.any(String) });
    });

    test('Geçerli JSON', () => {
        expect(repairJson('{"a": 1}', { logging: true })).toEqual([{ a: 1 }, []]);
        expect(loads('[1, 2]', { logging: true })).toEqual([[1, 2], []]);
    });

    test('JSON içermeyen metin', () => {
        expect(repairJson('merhaba', { logging: true })).toEqual(['', []]);
    });
});
