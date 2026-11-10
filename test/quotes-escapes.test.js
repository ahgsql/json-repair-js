const { loads, repairJson } = require('../src');

describe('Kaçış dizileri (issue #1)', () => {
    test('\\n, \\t ve \\uXXXX gerçek karakterlere çevrilmeli', () => {
        // Sondaki "x" bozuk (tırnaksız) olduğu için JSON.parse atlanıp onarıcıya düşer
        const input = '{"a": "satır1\\nsatır2\\tTab \\u00e9 \\u0041", b: x}';
        expect(loads(input)).toEqual({ a: "satır1\nsatır2\tTab é A", b: "x" });
    });

    test('Kaçışlı tırnak ve ters bölü korunmalı', () => {
        expect(loads('{"a": "say \\"hi\\"", b: 1}')).toEqual({ a: 'say "hi"', b: 1 });
        expect(loads('{"path": "C:\\\\dir\\\\", b: 1}')).toEqual({ path: 'C:\\dir\\', b: 1 });
        expect(loads("{'a': 'it\\'s', b: 1}")).toEqual({ a: "it's", b: 1 });
    });

    test('Çıktı JSON string olarak da doğru olmalı', () => {
        const out = repairJson('{"a": "x\\ny", b: 1}');
        expect(JSON.parse(out)).toEqual({ a: "x\ny", b: 1 });
    });

    test('Girdinin sonunda yarım kalan kaçış dizisi atılmalı', () => {
        expect(loads('{"a": "abc\\')).toEqual({ a: "abc" });
        expect(loads('{"a": "abc\\u00')).toEqual({ a: "abc" });
        expect(loads('{"a": "abc\\u00e')).toEqual({ a: "abc" });
    });

    test('Tırnaklı string baştaki/sondaki boşlukları korumalı', () => {
        expect(loads('{"a": "  x  ", b: 1}')).toEqual({ a: "  x  ", b: 1 });
    });
});

describe('Kaçışsız tırnaklar (issue #3)', () => {
    test('issue #3: {"a": "a"b"c"}', () => {
        expect(loads('{"a": "a"b"c"}')).toEqual({ a: 'a"b"c' });
        expect(JSON.parse(repairJson('{"a": "a"b"c"}', { returnObjects: false }))).toEqual({ a: 'a"b"c' });
    });

    test('String içindeki tırnaklı kelime', () => {
        expect(loads('{"a": "he said "hi" to me", "b": 1}')).toEqual({ a: 'he said "hi" to me', b: 1 });
    });

    test('Tırnak, virgülden önce gelse bile string devam edebilmeli', () => {
        expect(loads('{"a": "he said "hi", then left", "b": 1}')).toEqual({ a: 'he said "hi", then left', b: 1 });
    });

    test('Dizilerde kaçışsız tırnak', () => {
        expect(loads('["he said "hi" now", "x"]')).toEqual(['he said "hi" now', 'x']);
    });

    test('Tek tırnaklı string içindeki apostrof', () => {
        expect(loads("{'a': 'it's fine', 'b': 'x'}")).toEqual({ a: "it's fine", b: 'x' });
    });

    test('Eksik virgüller hâlâ onarılmalı', () => {
        expect(loads('["a" "b" "c"]')).toEqual(['a', 'b', 'c']);
        expect(loads('{"a": "x" "b": "y"}')).toEqual({ a: 'x', b: 'y' });
        expect(loads('{"a": "x" b: 1}')).toEqual({ a: 'x', b: 1 });
        expect(loads('["a" 1 2]')).toEqual(['a', 1, 2]);
    });

    test('Değerin hemen ardından gelen yapısal karakterler stringi kapatmalı', () => {
        expect(loads('{"a": "x"}')).toEqual({ a: 'x' });
        expect(loads('{"a": "x", "b": ["y", "z"], "c": {"d": "e"}}')).toEqual({ a: 'x', b: ['y', 'z'], c: { d: 'e' } });
        expect(loads('{"a": "x", b: 1}')).toEqual({ a: 'x', b: 1 });
        expect(loads('["a", b, c]')).toEqual(['a', 'b', 'c']);
        expect(loads('{"a": "x", // yorum\n "b": "y"}')).toEqual({ a: 'x', b: 'y' });
    });

    test('Girdi, sonraki öğe yazılırken kesilirse string kapanmalı', () => {
        expect(loads('{"a": "x", b')).toEqual({ a: 'x', b: '' });
        expect(loads('["a", b')).toEqual(['a', 'b']);
    });
});

describe('Akıllı tırnaklar', () => {
    test('“ ” anahtar ve değer için ayraç olmalı', () => {
        expect(loads('{“a”: “b”, “c”: 1}')).toEqual({ a: 'b', c: 1 });
        expect(loads('[“x”, “y”]')).toEqual(['x', 'y']);
    });

    test('„ “ ve ‘ ’ de desteklenmeli', () => {
        expect(loads('{„a“: ‘b’}')).toEqual({ a: 'b' });
    });

    test('Akıllı tırnakla açılan string içinde ASCII tırnak', () => {
        expect(loads('{“a”: “iki kelime”, “b”: “çift”}')).toEqual({ a: 'iki kelime', b: 'çift' });
    });

    test('ASCII tırnaklı string içindeki akıllı tırnaklar korunmalı', () => {
        expect(loads('{"a": "o dedi: “merhaba”", b: 1}')).toEqual({ a: 'o dedi: “merhaba”', b: 1 });
    });
});

describe('Diğer sağlamlaştırmalar', () => {
    test('__proto__ anahtarı prototipi değiştirmemeli', () => {
        const result = loads('{"__proto__": {"polluted": true}, b: 1}');
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        expect(result.polluted).toBeUndefined();
        expect(Object.keys(result)).toEqual(['__proto__', 'b']);
        expect({}.polluted).toBeUndefined();
    });

    test('Boş anahtar ve fazladan virgüller', () => {
        expect(loads('{"": 1, "a": 2}')).toEqual({ '': 1, a: 2 });
        expect(loads('{"a": 1,, "b": 2,}')).toEqual({ a: 1, b: 2 });
    });

    test('Üstel sayılar', () => {
        expect(loads('{a: 1e+5, b: 1E-2, c: 1e999, d: 12px, e: 1.2.3}')).toEqual({ a: 100000, b: 0.01, c: '1e999', d: '12px', e: '1.2.3' });
    });
});

describe('Geçerli JSON, onarıcıdan geçse de değişmemeli', () => {
    // Küçük, tohumlu rastgele üretici: tekrarlanabilir olsun diye Math.random kullanılmıyor
    function rng(seed) {
        return () => {
            seed = (seed * 1664525 + 1013904223) % 4294967296;
            return seed / 4294967296;
        };
    }

    const ALPHABET = ['a', 'b', ' ', '"', "'", '\\', '/', ',', ':', '{', '}', '[', ']', '\n', '\t', 'é', 'ş', '“', '”', '😀', '1', '-', '//', '/*'];

    function randomString(r) {
        let s = '';
        const len = Math.floor(r() * 8);
        for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(r() * ALPHABET.length)];
        return s;
    }

    function randomValue(r, depth) {
        const kind = Math.floor(r() * (depth > 3 ? 5 : 7));
        switch (kind) {
            case 0: return randomString(r);
            case 1: return Math.round((r() - 0.5) * 1e6) / 100;
            case 2: return r() < 0.5;
            case 3: return null;
            case 4: return Math.floor(r() * 1000);
            case 5: return Array.from({ length: Math.floor(r() * 4) }, () => randomValue(r, depth + 1));
            default: {
                const obj = {};
                const n = Math.floor(r() * 4);
                for (let i = 0; i < n; i++) obj[randomString(r)] = randomValue(r, depth + 1);
                return obj;
            }
        }
    }

    test('500 rastgele belge: onarıcı sonucu JSON.parse ile aynı olmalı', () => {
        const r = rng(42);
        for (let i = 0; i < 500; i++) {
            const value = { root: randomValue(r, 0) };
            const text = JSON.stringify(value, null, i % 2 ? 2 : 0);
            let result;
            try {
                result = loads(text, { skipJsonParse: true });
            } catch (e) {
                throw new Error(`parser threw for ${text}: ${e.message}`);
            }
            expect({ input: text, result }).toEqual({ input: text, result: JSON.parse(text) });
        }
    });
});
