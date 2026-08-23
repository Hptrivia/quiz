import SwiftUI
import WebKit

private let siteURL = URL(string: "https://triviagauntlet.app/")!
private let allowedHost = "triviagauntlet.app"
private let uaTag = "TriviaGauntletPremium"

// Fan-submitted/community trivia question pages - not exposed in the premium
// app so it doesn't carry user-generated-content/social capabilities on iOS.
// Site itself, the free app, and Android are unaffected.
private let blockedPaths = ["/fan-create", "/fan-play", "/fan-questions"]

struct WebContainerView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero)
        webView.navigationDelegate = context.coordinator

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

    // Keeps the app scoped to triviagauntlet.app - anything off-domain (or a
    // non-http scheme like mailto:) opens in the system browser instead of
    // inside the WebView, so this isn't an unrestricted in-app browser.
    final class Coordinator: NSObject, WKNavigationDelegate {
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            let scheme = url.scheme?.lowercased() ?? ""
            guard scheme == "http" || scheme == "https" else {
                decisionHandler(.cancel)
                UIApplication.shared.open(url)
                return
            }

            let host = url.host ?? ""
            let isOnSite = host == allowedHost || host.hasSuffix(".\(allowedHost)")
            guard isOnSite else {
                decisionHandler(.cancel)
                UIApplication.shared.open(url)
                return
            }

            let path = url.path.lowercased()
            let isBlocked = blockedPaths.contains { path.hasPrefix($0) }
            decisionHandler(isBlocked ? .cancel : .allow)
        }
    }
}
