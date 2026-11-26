import SwiftUI
import WidgetKit

private var appGroup: String {
  var id = Bundle.main.bundleIdentifier ?? ""
  if id.hasSuffix(".widget") { id = String(id.dropLast(".widget".count)) }
  return "group." + id
}

struct EVEntry: TimelineEntry {
  let date: Date
  let name: String
  let overall: String
  let warn: Int
  let fail: Int
  let skipped: Int
  let hasData: Bool
}

struct EVProvider: TimelineProvider {
  func placeholder(in context: Context) -> EVEntry {
    EVEntry(date: Date(), name: "Model 3", overall: "warn", warn: 1, fail: 0, skipped: 3, hasData: true)
  }

  func getSnapshot(in context: Context, completion: @escaping (EVEntry) -> Void) { completion(read()) }

  func getTimeline(in context: Context, completion: @escaping (Timeline<EVEntry>) -> Void) {
    let entry = read()
    let next = Calendar.current.startOfDay(for: Date()).addingTimeInterval(86400)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }

  private func read() -> EVEntry {
    guard let d = UserDefaults(suiteName: appGroup),
          let raw = d.string(forKey: "ev_snapshot"),
          let data = raw.data(using: .utf8),
          let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
      return EVEntry(date: Date(), name: "", overall: "notEvaluated", warn: 0, fail: 0, skipped: 0, hasData: false)
    }
    return EVEntry(
      date: Date(),
      name: obj["name"] as? String ?? "Your car",
      overall: obj["overall"] as? String ?? "notEvaluated",
      warn: obj["warn"] as? Int ?? 0,
      fail: obj["fail"] as? Int ?? 0,
      skipped: obj["notEvaluated"] as? Int ?? 0,
      hasData: true
    )
  }
}

struct EVView: View {
  var entry: EVEntry

  private var ink: Color { Color(red: 0.071, green: 0.098, blue: 0.090) }
  private var sub: Color { Color(red: 0.361, green: 0.396, blue: 0.376) }
  private var accent: Color { Color(red: 0.059, green: 0.420, blue: 0.329) }
  private var warn: Color { Color(red: 0.706, green: 0.376, blue: 0.039) }
  private var fail: Color { Color(red: 0.639, green: 0.169, blue: 0.129) }
  private var bg: Color { Color(red: 0.969, green: 0.973, blue: 0.969) }

  private var statusText: String {
    switch entry.overall {
    case "fail": return "STOP"
    case "warn": return "WATCH"
    case "pass": return "OK"
    default: return "NO DATA"
    }
  }
  private var statusColor: Color {
    switch entry.overall {
    case "fail": return fail
    case "warn": return warn
    case "pass": return accent
    default: return sub
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text("EV CHECK")
        .font(.system(size: 9, weight: .semibold))
        .tracking(0.8)
        .foregroundStyle(sub)

      if entry.hasData {
        Text(statusText)
          .font(.system(size: 28, weight: .bold, design: .rounded))
          .foregroundStyle(statusColor)
        Text(entry.name)
          .font(.system(size: 13, weight: .semibold))
          .lineLimit(1)
          .foregroundStyle(ink)
        Text("\(entry.warn) watch · \(entry.skipped) unmeasured")
          .font(.system(size: 10))
          .foregroundStyle(sub)
      } else {
        Text("No verdict yet")
          .font(.system(size: 20, weight: .bold, design: .rounded))
          .foregroundStyle(ink)
        Text("Log a charge or a range reading")
          .font(.system(size: 10))
          .lineLimit(2)
          .foregroundStyle(sub)
      }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(12)
    .containerBackground(bg, for: .widget)
  }
}

@main
struct EVPrecheckWidget: Widget {
  let kind = "EVPrecheckStatus"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: EVProvider()) { entry in
      EVView(entry: entry)
    }
    .configurationDisplayName("EV status")
    .description("Shows the last check verdict and how many checks still have no data.")
    .supportedFamilies([.systemSmall])
  }
}
