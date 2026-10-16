import importlib.util
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('official_shaking', ROOT / 'tools/update-official-shaking.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class OfficialGrid(unittest.TestCase):
    def xml(self, values=None):
        values = values or [3, 4, 5, 6, 7, 8]
        # Published rows run north to south. The shared renderer requires south to north.
        rows = '\n'.join(f'{x} {y} {values[i]}' for i, (x, y) in enumerate([(0, 1), (1, 1), (2, 1), (0, 0), (1, 0), (2, 0)]))
        return f'''<shakemap_grid shakemap_event_type="ACTUAL"><event event_id="real-qa" event_timestamp="2026-10-12T20:20:36Z" lat="1" lon="1" magnitude="6.1"/><grid_specification nlon="3" nlat="2" lon_min="0" lon_max="2" lat_min="0" lat_max="1"/><grid_field name="LON" index="1"/><grid_field name="LAT" index="2"/><grid_field name="MMI" index="3"/><grid_data>{rows}</grid_data></shakemap_grid>'''.encode()

    def test_published_axes_and_no_data_are_preserved(self):
        q = {'lat': 1, 'lng': 1, 'mag': 6.1, 'time': module.epoch('2026-10-12T20:20:36Z')}
        g = module.compact_grid(self.xml([3, -9999, 5, 6, 7, 8]), q, 'real-qa')
        self.assertEqual(g['values'], [6, 7, 8, 3, None, 5])
        self.assertEqual((g['nx'], g['ny']), (3, 2))

    def test_unrelated_origins_and_scenarios_are_rejected(self):
        q = {'lat': 1, 'lng': 1, 'mag': 6.1, 'time': module.epoch('2026-10-12T20:20:36Z')}
        for raw in [self.xml().replace(b'ACTUAL', b'SCENARIO'), self.xml().replace(b'real-qa', b'other'), self.xml().replace(b'20:20:36Z', b'21:20:36Z')]:
            with self.assertRaises(ValueError):
                module.compact_grid(raw, q, 'real-qa')

    def test_duplicate_cells_are_rejected(self):
        q = {'lat': 1, 'lng': 1, 'mag': 6.1, 'time': module.epoch('2026-10-12T20:20:36Z')}
        with self.assertRaises(ValueError):
            module.compact_grid(self.xml().replace(b'2 1 5', b'1 1 5'), q, 'real-qa')

    def test_published_catalogue_is_bounded_and_origins_match(self):
        base = ROOT / 'data/official-shaking'
        index = json.loads((base / 'index.json').read_text())
        self.assertGreaterEqual(len(index['events']), 2)
        self.assertLessEqual(len(index['events']), 48)
        for row in index['events']:
            data = json.loads((base / row['path']).read_text())
            self.assertEqual(data['eventId'], row['eventId'])
            self.assertEqual(data['version'], row['version'])
            self.assertTrue(module.same(row, data['origin']))
            self.assertLessEqual(len(data['grid']['values']), 16000)


if __name__ == '__main__':
    unittest.main()
