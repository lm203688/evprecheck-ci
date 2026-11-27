"""CI-only patcher: injects a hands-free UI tour for simulator screen recordings.

Applied inside the GitHub Actions workspace only; the repository source is
never modified. The tour is gated behind EXPO_PUBLIC_TOUR === '1', which release
builds never set, so the shipped binary is unaffected.
"""

import pathlib

APP_TOUR = """
  // CI recording tour: only active when EXPO_PUBLIC_TOUR=1 at bundle time.
  useEffect(() => {
    let alive = true;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      await wait(1800);
      if (!alive) return;
      await addVehicle({
        name: '2021 Model 3 LR',
        vin: '5YJ3E1EA7MF123456',
        registeredYear: '2021',
        epaRangeKm: '614',
        chemistry: 'NMC',
        warrantyEnd: '2026-06-30',
      });
      await wait(3600);
      if (!alive) return;
      let s = await store.load();
      const vid = s.vehicles[0] && s.vehicles[0].id;
      if (!vid) return;
      setTab('ledger');
      await wait(2000);
      const charges = [
        { date: '2026-11-18', startSoc: '9', endSoc: '76', billedKwh: '51.2', cost: '18.40', current: 'DC', distanceKm: '301', dashKwhPer100: '15.1', peakKw: '164', tempC: '18', interrupted: false },
        { date: '2026-11-20', startSoc: '12', endSoc: '80', billedKwh: '52.8', cost: '19.10', current: 'DC', distanceKm: '318', dashKwhPer100: '14.9', peakKw: '171', tempC: '16', interrupted: false },
        { date: '2026-11-22', startSoc: '15', endSoc: '72', billedKwh: '44.6', cost: '16.20', current: 'DC', distanceKm: '268', dashKwhPer100: '15.4', peakKw: '158', tempC: '14', interrupted: false },
        { date: '2026-11-24', startSoc: '11', endSoc: '82', billedKwh: '55.1', cost: '20.30', current: 'DC', distanceKm: '326', dashKwhPer100: '15.0', peakKw: '176', tempC: '12', interrupted: false },
        { date: '2026-11-26', startSoc: '20', endSoc: '68', billedKwh: '38.4', cost: '13.90', current: 'DC', distanceKm: '241', dashKwhPer100: '15.3', peakKw: '152', tempC: '10', interrupted: false },
      ];
      for (let i = 0; i < charges.length; i += 1) {
        if (!alive) return;
        s = await store.addCharge(s, { ...charges[i], vehicleId: vid });
        setState(s);
        await wait(1700);
      }
      for (let i = 0; i < 3; i += 1) {
        if (!alive) return;
        s = await store.addReading(s, { type: 'range', value: '498', tempC: '18', vehicleId: vid });
        setState(s);
        await wait(1000);
      }
      if (!alive) return;
      s = await store.addReading(s, { type: 'warm', value: '514', tempC: '25', vehicleId: vid });
      setState(s);
      await wait(1000);
      if (!alive) return;
      s = await store.addReading(s, { type: 'winter', value: '392', tempC: '-6', vehicleId: vid });
      setState(s);
      await wait(1000);
      if (!alive) return;
      s = await store.addReading(s, { type: 'aux', value: '12.4', vehicleId: vid });
      setState(s);
      await wait(1700);
      if (!alive) return;
      setTab('check');
      await wait(9000);
      if (!alive) return;
      setTab('garage');
      await wait(7000);
      if (!alive) return;
      setTab('report');
      await wait(8000);
    })();
    return () => {
      alive = false;
    };
  }, []);
"""


def patch():
    app = pathlib.Path("App.js")
    s = app.read_text()
    anchor = "  const common = { vehicle, result, aiStatus, onNav: setTab };"
    if anchor not in s:
        raise SystemExit("App.js anchor missing")
    if "CI recording tour" in s:
        print("App.js already patched")
    else:
        app.write_text(s.replace(anchor, anchor + "\n" + APP_TOUR, 1))
        print("App.js patched")


if __name__ == "__main__":
    patch()



