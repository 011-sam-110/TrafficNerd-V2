// Importing this file registers every console widget exactly once.
import "@/lib/console/widgets/aviation";
import "@/lib/console/widgets/events";
import "@/lib/console/widgets/cameras";
import "@/lib/console/widgets/news";
import "@/lib/console/widgets/satellites";
import "@/lib/console/widgets/markets";
import "@/lib/console/widgets/headlines";
import "@/lib/console/widgets/locate";
// Registers one generic monitor widget per global signal source (≈30 layers).
import "@/lib/console/widgets/signals";
// Registers the six passive-OSINT "Tools" recon widgets (dns/whois/certs/bgp/ports/threat).
import "@/lib/console/widgets/recon";
