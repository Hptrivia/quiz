import SwiftUI
import WebKit

private let siteURL = URL(string: "https://triviagauntlet.app/")!
private let uaTag = "TriviaGauntletPremium"

struct WebContainerView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero)

        // Read the default UA and append our tag BEFORE loading the real site,
        // so the site's JS never sees a request without the tag present
        // (avoids the async-race class of bug the Android admob/RevenueCat work hit).
        webView.evaluateJavaScript("navigator.userAgent") { result, _ in
            let baseUA = (result as? String) ?? ""
            webView.customUserAgent = baseUA.isEmpty ? uaTag : "\(baseUA) \(uaTag)"
            webView.load(URLRequest(url: siteURL))
        }

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
