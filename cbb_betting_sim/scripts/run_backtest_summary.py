from scripts.backtest import run_backtest
import pandas as pd


def main():
    df = run_backtest("2024-11-01", "2025-03-15")

    print(df.tail())

    print("\nSUMMARY")
    print("Total Bets:", len(df))
    units = df["units"].sum() if not df.empty else 0
    stakes = df["stake"].sum() if not df.empty else 0
    roi = units / stakes if stakes != 0 else float("nan")
    win_rate = (df["result"] == "W").mean() if not df.empty else float("nan")

    print("Units Won:", units)
    print("ROI:", roi)
    print("Win Rate:", f"{win_rate:.2%}" if not pd.isna(win_rate) else "n/a")

    # Compute drawdown
    if not df.empty:
        df["peak"] = df["bankroll"].cummax()
        df["drawdown"] = df["bankroll"] - df["peak"]
        max_dd = df["drawdown"].min()
    else:
        max_dd = 0

    print("Max Drawdown:", max_dd)

    # CLV metrics
    if not df.empty and "clv" in df.columns:
        avg_clv = round(df["clv"].mean(), 3)
        pct_positive = round((df["clv"] > 0).mean() * 100, 1)
        print("\nCLV METRICS")
        print("Average CLV:", avg_clv)
        print("CLV > 0 %:", pct_positive)
        # CLV buckets and units performance
        try:
            df["clv_bucket"] = pd.cut(df["clv"], bins=[-10, -2, -1, 0, 1, 2, 10])
            print("\nUnits mean by CLV bucket:")
            print(df.groupby("clv_bucket")["units"].mean())
        except Exception as e:
            print("Failed to compute CLV buckets:", e)


if __name__ == "__main__":
    main()
