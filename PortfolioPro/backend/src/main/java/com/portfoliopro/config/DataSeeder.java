package com.portfoliopro.config;

import com.portfoliopro.dto.MarketDtos.CandleDto;
import com.portfoliopro.dto.OrderDtos.PlaceOrderRequest;
import com.portfoliopro.entity.OhlcvCandle;
import com.portfoliopro.entity.Stock;
import com.portfoliopro.entity.User;
import com.portfoliopro.entity.Wallet;
import com.portfoliopro.entity.WalletTransaction;
import com.portfoliopro.entity.Watchlist;
import com.portfoliopro.entity.enums.OrderSide;
import com.portfoliopro.entity.enums.OrderType;
import com.portfoliopro.entity.enums.TransactionType;
import com.portfoliopro.repository.OhlcvCandleRepository;
import com.portfoliopro.repository.StockRepository;
import com.portfoliopro.repository.UserRepository;
import com.portfoliopro.repository.WalletRepository;
import com.portfoliopro.repository.WalletTransactionRepository;
import com.portfoliopro.repository.WatchlistRepository;
import com.portfoliopro.service.MarketDataService;
import com.portfoliopro.service.TradeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final StockRepository stockRepository;
    private final OhlcvCandleRepository candleRepository;
    private final MarketDataService marketDataService;
    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final WalletTransactionRepository walletTransactionRepository;
    private final WatchlistRepository watchlistRepository;
    private final PasswordEncoder passwordEncoder;
    private final TradeService tradeService;

    public DataSeeder(
            StockRepository stockRepository,
            OhlcvCandleRepository candleRepository,
            MarketDataService marketDataService,
            UserRepository userRepository,
            WalletRepository walletRepository,
            WalletTransactionRepository walletTransactionRepository,
            WatchlistRepository watchlistRepository,
            PasswordEncoder passwordEncoder,
            TradeService tradeService
    ) {
        this.stockRepository = stockRepository;
        this.candleRepository = candleRepository;
        this.marketDataService = marketDataService;
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;
        this.walletTransactionRepository = walletTransactionRepository;
        this.watchlistRepository = watchlistRepository;
        this.passwordEncoder = passwordEncoder;
        this.tradeService = tradeService;
    }

    @Override
    public void run(String... args) {
        if (stockRepository.count() == 0) {
            seedStocks();
        }
        if (candleRepository.count() == 0) {
            seedInitialCandles();
        }
        if (!userRepository.existsByEmailIgnoreCase("demo@portfoliopro.in")) {
            seedDemoAccount();
        }
        log.info("[PortfolioPro] Ready on http://localhost:8080 | Demo Login: demo@portfoliopro.in / Demo@1234");
    }

    private void seedInitialCandles() {
        List<String> coreSymbols = List.of("RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "SBIN", "LT", "TATAMOTORS");
        List<OhlcvCandle> batch = new ArrayList<>();
        for (String sym : coreSymbols) {
            stockRepository.findBySymbolIgnoreCase(sym).ifPresent(stock -> {
                for (CandleDto c : marketDataService.synthesizeCandles(stock, "1D")) {
                    batch.add(OhlcvCandle.builder()
                            .symbol(stock.getSymbol())
                            .timeframe("1D")
                            .epochSec(c.time())
                            .openPrice(c.open())
                            .highPrice(c.high())
                            .lowPrice(c.low())
                            .closePrice(c.close())
                            .volume(c.volume())
                            .build());
                }
            });
        }
        if (!batch.isEmpty()) {
            candleRepository.saveAll(batch);
        }
    }

    private void seedStocks() {
        List<Stock> seeds = List.of(
                stock("RELIANCE", "Reliance Industries Ltd", "Energy & Power", "Integrated Oil, Telecom & Retail", 2984.50, 2956.20, 3217.90, 2520.00, 2018450, 27.8, 2.45, 107.35, 9.8, 0.41, 0.34, 1.06, 0.21, 11.4, 7.9, "India's largest private enterprise spanning Jio digital, retail, O2C refining, and green energy."),
                stock("TCS", "Tata Consultancy Services Ltd", "Information Technology", "IT Services & Consulting", 4142.80, 4118.40, 4592.25, 3590.10, 1498720, 30.4, 15.20, 136.28, 51.4, 0.09, 1.78, 0.78, 0.18, 6.8, 19.3, "Global Tier-1 IT services, cloud transformation, and enterprise consulting leader."),
                stock("HDFCBANK", "HDFC Bank Ltd", "Banking & Financials", "Private Sector Bank", 1746.60, 1731.90, 1840.00, 1380.25, 1331400, 19.4, 2.82, 90.03, 16.1, 1.12, 1.12, 0.96, 0.19, 16.2, 24.1, "Premier Indian private sector bank across retail, corporate, and wealth franchises."),
                stock("ICICIBANK", "ICICI Bank Ltd", "Banking & Financials", "Private Sector Bank", 1312.40, 1298.75, 1362.35, 1008.10, 924800, 20.6, 3.45, 63.71, 18.4, 1.05, 0.76, 1.02, 0.20, 17.9, 26.4, "High-RoA private bank leading in digital SME and retail lending."),
                stock("INFY", "Infosys Ltd", "Information Technology", "IT Services & Digital", 1878.25, 1892.10, 1991.80, 1358.35, 779200, 28.9, 8.60, 64.99, 31.8, 0.10, 2.05, 0.85, 0.21, 5.9, 16.8, "Digital services and AI/cloud engineering leader serving global Fortune 500 enterprises."),
                stock("SBIN", "State Bank of India", "Banking & Financials", "Public Sector Bank", 838.90, 831.20, 912.00, 675.50, 748600, 10.8, 1.78, 77.68, 18.9, 1.28, 1.63, 1.24, 0.25, 15.4, 18.7, "India's flagship public sector bank commanding over 22% deposit share."),
                stock("LT", "Larsen & Toubro Ltd", "Infrastructure & Cement", "Engineering & Construction", 3642.00, 3615.50, 3948.60, 3175.00, 501200, 36.2, 5.65, 100.61, 16.4, 1.08, 0.77, 1.12, 0.22, 15.1, 6.4, "Multinational EPC leader executing mega infrastructure, defense, and energy projects."),
                stock("ITC", "ITC Ltd", "FMCG & Consumer", "Diversified FMCG", 488.45, 491.10, 528.50, 399.35, 610800, 29.4, 8.25, 16.61, 28.4, 0.01, 2.82, 0.66, 0.16, 8.7, 27.6, "Cash-generative Indian FMCG, agri-business, and packaged foods enterprise."),
                stock("TATAMOTORS", "Tata Motors Ltd", "Automobile", "Passenger, Commercial & EVs", 918.70, 904.30, 1179.00, 775.00, 338100, 11.4, 3.62, 80.59, 31.2, 0.64, 0.65, 1.34, 0.29, 12.6, 7.1, "Automotive manufacturer owning Jaguar Land Rover and leading India EV passenger cars."),
                stock("SUNPHARMA", "Sun Pharmaceutical Industries", "Pharmaceuticals", "Specialty & Generics", 1864.20, 1848.90, 1960.35, 1377.00, 447200, 39.8, 6.45, 46.84, 17.6, 0.04, 0.72, 0.62, 0.17, 11.9, 20.4, "India's largest pharmaceutical company and global specialty dermatology leader."),
                stock("BAJFINANCE", "Bajaj Finance Ltd", "Banking & Financials", "Consumer & SME NBFC", 7124.50, 7180.00, 7830.00, 6187.80, 441200, 28.4, 5.38, 250.86, 21.6, 3.45, 0.51, 1.19, 0.25, 24.8, 25.9, "Diversified consumer and SME NBFC serving 92M+ Indian borrowers."),
                stock("KOTAKBANK", "Kotak Mahindra Bank Ltd", "Banking & Financials", "Private Sector Bank", 1792.30, 1784.00, 1942.00, 1543.85, 356300, 19.1, 2.65, 93.84, 15.3, 0.98, 0.11, 0.89, 0.19, 14.3, 24.8, "Integrated banking, wealth management, asset management, and capital markets franchise."),
                stock("AXISBANK", "Axis Bank Ltd", "Banking & Financials", "Private Sector Bank", 1188.60, 1179.40, 1339.65, 995.70, 367900, 14.2, 2.24, 83.70, 17.5, 1.18, 0.09, 1.11, 0.22, 15.8, 21.9, "Third-largest Indian private sector bank with strong corporate and affluent retail banking."),
                stock("HCLTECH", "HCL Technologies Ltd", "Information Technology", "IT Services & ER&D", 1842.15, 1826.50, 1898.00, 1235.00, 499800, 29.8, 7.25, 61.82, 24.6, 0.08, 2.82, 0.84, 0.20, 7.4, 14.9, "Global technology company combining cloud infrastructure, ER&D, and enterprise software."),
                stock("WIPRO", "Wipro Ltd", "Information Technology", "IT Services & Consulting", 556.80, 562.40, 584.90, 418.00, 291100, 24.6, 3.74, 22.63, 15.4, 0.21, 1.08, 0.92, 0.22, 1.8, 13.1, "Global IT consulting and digital operations partner with Capco BFSI advisory."),
                stock("TECHM", "Tech Mahindra Ltd", "Information Technology", "Telecom & Enterprise IT", 1692.40, 1679.80, 1761.30, 1162.95, 165600, 38.4, 6.12, 44.07, 15.9, 0.09, 2.36, 0.95, 0.23, 3.4, 8.9, "Specialist telecom, manufacturing, and digital engineering IT services provider."),
                stock("MARUTI", "Maruti Suzuki India Ltd", "Automobile", "Passenger Vehicles", 12185.00, 12110.50, 13680.00, 9920.00, 383100, 26.8, 4.42, 454.66, 17.8, 0.01, 1.03, 0.81, 0.19, 10.8, 9.8, "India's largest passenger vehicle maker scaling SUVs, CNG, hybrids, and exports."),
                stock("M&M", "Mahindra & Mahindra Ltd", "Automobile", "SUVs & Farm Equipment", 2945.60, 2912.00, 3222.10, 1575.00, 366200, 29.7, 5.85, 99.18, 21.4, 0.18, 0.72, 1.16, 0.25, 16.9, 10.6, "Market leader in Indian farm tractors and lifestyle SUVs."),
                stock("BAJAJ-AUTO", "Bajaj Auto Ltd", "Automobile", "Two & Three Wheelers", 9876.00, 9942.50, 12774.00, 6480.00, 275800, 33.4, 9.85, 295.69, 30.8, 0.03, 0.81, 0.88, 0.22, 18.4, 16.9, "Global 2W and 3W exporter scaling Chetak electric scooters and CNG motorcycles."),
                stock("HINDUNILVR", "Hindustan Unilever Ltd", "FMCG & Consumer", "Household & Personal Care", 2564.80, 2549.20, 3035.00, 2172.05, 602600, 57.8, 11.75, 44.37, 20.6, 0.03, 1.64, 0.54, 0.15, 4.2, 16.9, "India's largest consumer goods company across home care, beauty, and foods."),
                stock("TITAN", "Titan Company Ltd", "FMCG & Consumer", "Jewellery & Watches", 3348.50, 3318.90, 3886.95, 3055.65, 297300, 82.4, 26.80, 40.64, 34.2, 0.82, 0.33, 0.86, 0.21, 19.6, 7.2, "Tata lifestyle flagship leading organized jewellery via Tanishq and CaratLane."),
                stock("NESTLEIND", "Nestle India Ltd", "FMCG & Consumer", "Packaged Foods", 2314.00, 2328.40, 2778.00, 2195.00, 223100, 69.5, 58.40, 33.29, 86.5, 0.11, 1.38, 0.51, 0.15, 7.6, 15.8, "Packaged foods and beverages leader with industry-leading ROIC."),
                stock("NTPC", "NTPC Ltd", "Energy & Power", "Power Generation", 412.60, 406.80, 448.45, 268.00, 400100, 18.9, 2.48, 21.83, 13.6, 1.42, 1.94, 1.08, 0.23, 9.8, 11.9, "India's largest power generation utility scaling 60 GW renewable energy capacity."),
                stock("POWERGRID", "Power Grid Corporation of India", "Energy & Power", "Electric Transmission", 324.75, 321.40, 366.25, 208.10, 302000, 19.3, 3.41, 16.83, 18.2, 1.38, 3.46, 0.91, 0.21, 6.4, 33.8, "Central power transmission utility carrying ~45% of India's electricity."),
                stock("ONGC", "Oil & Natural Gas Corporation", "Energy & Power", "Upstream Oil & Gas", 274.30, 277.90, 345.00, 192.20, 345100, 7.4, 1.02, 37.07, 14.5, 0.44, 4.45, 1.22, 0.27, 5.1, 8.4, "India's largest upstream crude oil and natural gas producer."),
                stock("ADANIGREEN", "Adani Green Energy Ltd", "Energy & Power", "Renewable Power", 1685.00, 1712.40, 2174.10, 1086.00, 266900, 142.5, 24.60, 11.82, 17.9, 5.85, 0.00, 1.58, 0.39, 28.4, 13.7, "Utility-scale solar and wind renewable developer building the 30 GW Khavda park."),
                stock("DRREDDY", "Dr. Reddy's Laboratories Ltd", "Pharmaceuticals", "Global Generics", 1294.60, 1282.10, 1421.49, 1092.00, 108000, 19.6, 3.68, 66.05, 20.1, 0.07, 0.62, 0.61, 0.18, 13.8, 19.6, "Global generics, biosimilars, and complex injectables pharmaceutical manufacturer."),
                stock("CIPLA", "Cipla Ltd", "Pharmaceuticals", "Respiratory & Branded Pharma", 1548.90, 1536.00, 1702.05, 1185.00, 125100, 28.1, 4.52, 55.12, 16.9, 0.03, 0.84, 0.59, 0.17, 10.4, 16.8, "Respiratory inhalation and chronic therapy pharmaceutical powerhouse."),
                stock("TATASTEEL", "Tata Steel Ltd", "Metals & Mining", "Integrated Steel", 152.85, 150.40, 184.60, 124.20, 190800, 26.4, 2.08, 5.79, 8.2, 0.94, 2.36, 1.38, 0.28, 3.2, 3.9, "Captive iron-ore integrated steel producer ramping Kalinganagar 5 MTPA expansion."),
                stock("ULTRACEMCO", "UltraTech Cement Ltd", "Infrastructure & Cement", "Cement & Building Materials", 11290.00, 11215.00, 12145.35, 9250.00, 325900, 45.8, 5.34, 246.51, 12.4, 0.24, 0.62, 0.87, 0.20, 9.4, 10.1, "India's largest grey cement and ready-mix concrete producer.")
        );
        stockRepository.saveAll(seeds);
    }

    private void seedDemoAccount() {
        User demo = userRepository.save(User.builder()
                .fullName("Aarav Mehta")
                .email("demo@portfoliopro.in")
                .passwordHash(passwordEncoder.encode("Demo@1234"))
                .theme("dark")
                .build());

        BigDecimal initial = new BigDecimal("1000000.00");
        walletRepository.save(Wallet.builder()
                .user(demo)
                .balance(initial)
                .blockedMargin(BigDecimal.ZERO)
                .totalDeposited(initial)
                .totalWithdrawn(BigDecimal.ZERO)
                .build());

        walletTransactionRepository.save(WalletTransaction.builder()
                .user(demo)
                .type(TransactionType.DEPOSIT)
                .amount(initial)
                .balanceAfter(initial)
                .description("Initial Virtual Trading Capital Allocation (₹10,00,000)")
                .build());

        watchlistRepository.save(Watchlist.builder()
                .user(demo)
                .name("Nifty Core Leaders")
                .symbols(new ArrayList<>(List.of("RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "LT", "ITC", "SBIN")))
                .build());

        watchlistRepository.save(Watchlist.builder()
                .user(demo)
                .name("High Alpha & Auto")
                .symbols(new ArrayList<>(List.of("TATAMOTORS", "M&M", "BAJFINANCE", "SUNPHARMA", "TITAN")))
                .build());

        // Seed diversified positions with Stop-Loss and Target
        tradeService.placeOrder(demo.getId(), new PlaceOrderRequest("RELIANCE", OrderSide.BUY, OrderType.MARKET, 40, null, new BigDecimal("2720.00"), new BigDecimal("3290.00")), "MANUAL");
        tradeService.placeOrder(demo.getId(), new PlaceOrderRequest("TCS", OrderSide.BUY, OrderType.MARKET, 25, null, new BigDecimal("3850.00"), new BigDecimal("4490.00")), "MANUAL");
        tradeService.placeOrder(demo.getId(), new PlaceOrderRequest("HDFCBANK", OrderSide.BUY, OrderType.MARKET, 65, null, new BigDecimal("1620.00"), new BigDecimal("1920.00")), "MANUAL");
        tradeService.placeOrder(demo.getId(), new PlaceOrderRequest("ICICIBANK", OrderSide.BUY, OrderType.MARKET, 75, null, new BigDecimal("1195.00"), new BigDecimal("1460.00")), "MANUAL");
        tradeService.placeOrder(demo.getId(), new PlaceOrderRequest("TATAMOTORS", OrderSide.BUY, OrderType.MARKET, 85, null, new BigDecimal("845.00"), new BigDecimal("1090.00")), "MANUAL");
        tradeService.placeOrder(demo.getId(), new PlaceOrderRequest("SUNPHARMA", OrderSide.BUY, OrderType.MARKET, 40, null, new BigDecimal("1710.00"), new BigDecimal("2050.00")), "MANUAL");
    }

    private Stock stock(
            String sym, String name, String sector, String industry,
            double ltp, double prev, double h52, double l52, double mcap,
            double pe, double pb, double eps, double roe, double de, double div,
            double beta, double vol, double revG, double margin, String about
    ) {
        return Stock.builder()
                .symbol(sym).name(name).sector(sector).industry(industry)
                .basePrice(ltp).ltp(ltp).openPrice(prev)
                .dayHigh(Math.max(ltp, prev * 1.008)).dayLow(Math.min(ltp, prev * 0.992))
                .prevClose(prev).volume(420_000L)
                .high52w(h52).low52w(l52).marketCapCr(mcap)
                .peRatio(pe).pbRatio(pb).eps(eps).roe(roe)
                .debtToEquity(de).dividendYield(div).beta(beta)
                .annualVolatility(vol).revenueGrowthYoY(revG).netProfitMargin(margin)
                .about(about)
                .build();
    }
}
