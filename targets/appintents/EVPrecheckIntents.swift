import AppIntents
import Foundation

// The intent reads the same App Group snapshot the app writes, so Siri can never
// disagree with the screen. No duplicate maths lives here on purpose.
private func snapshot() -> [String: Any]? {
  let group = "group." + (Bundle.main.bundleIdentifier ?? "com.lixing.evprecheck")
  guard let d = UserDefaults(suiteName: group),
        let raw = d.string(forKey: "ev_snapshot"),
        let data = raw.data(using: .utf8) else { return nil }
  return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
}

@available(iOS 16.0, *)
struct EVStatusIntent: AppIntent {
  static var title: LocalizedStringResource = "EV check status"
  static var description: IntentDescription? = IntentDescription(
    "Reports the last EVPrecheck verdict for your car and how many checks were skipped."
  )
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let s = snapshot() else {
      return .result(dialog: "No check has run yet. Open EVPrecheck to log a charge or a range reading.")
    }
    let name = s["name"] as? String ?? "Your car"
    let overall = s["overall"] as? String ?? "notEvaluated"
    let warn = s["warn"] as? Int ?? 0
    let fail = s["fail"] as? Int ?? 0
    let skipped = s["notEvaluated"] as? Int ?? 0

    let head: String
    switch overall {
    case "fail": head = "\(name): stop and get it checked. \(fail) safety-level flag(s)."
    case "warn": head = "\(name): \(warn) item(s) are drifting, nothing needs a shop today."
    case "pass": head = "\(name): measured checks are inside range."
    default: head = "\(name) has no measured checks yet."
    }
    let tail = skipped > 0 ? " \(skipped) check(s) were skipped, so this is not a full inspection." : ""
    return .result(dialog: "\(head)\(tail)")
  }
}

@available(iOS 16.0, *)
struct OpenEVPrecheckIntent: AppIntent {
  static var title: LocalizedStringResource = "Open EVPrecheck"
  static var description: IntentDescription? = IntentDescription(
    "Opens the 12-point EV inspection and the charging ledger."
  )
  static var openAppWhenRun: Bool = true

  func perform() async throws -> some IntentResult {
    return .result()
  }
}

@available(iOS 16.0, *)
struct EVPrecheckShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: EVStatusIntent(),
      phrases: [
        "How is my EV in \(.applicationName)",
        "Check my battery in \(.applicationName)",
      ],
      shortTitle: "EV status",
      systemImageName: "bolt.car"
    )
    AppShortcut(
      intent: OpenEVPrecheckIntent(),
      phrases: ["Open \(.applicationName)", "Log a charge in \(.applicationName)"],
      shortTitle: "Open EVPrecheck",
      systemImageName: "bolt.car.fill"
    )
  }
}
