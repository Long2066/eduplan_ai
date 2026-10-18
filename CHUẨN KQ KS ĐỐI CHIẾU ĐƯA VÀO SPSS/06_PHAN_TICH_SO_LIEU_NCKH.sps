* ====================================================================.
* EDUPLAN AI - CU PHAP PHAN TICH SO LIEU CHUONG 3 NCKH.
* File du lieu: 01_SPSS_DOI_CHIEU_EDUPLAN.sav.
* ====================================================================.

DATASET ACTIVATE DOI_CHIEU.

* --------------------------------------------------------------------.
* 1. KIEM TRA DO TIN CAY THANG DO (CRONBACH'S ALPHA).
* --------------------------------------------------------------------.
* Thang đo SP (Chất lượng sản phẩm KHBD - 5 biến).
RELIABILITY
  /VARIABLES=SP1 SP2 SP3 SP4 SP5
  /SCALE('Thang do SP') ALL
  /MODEL=ALPHA
  /SUMMARY=TOTAL.

* Thang đo TAM (Mô hình chấp nhận công nghệ - 5 biến).
RELIABILITY
  /VARIABLES=TAM1 TAM2 TAM3 TAM4 TAM5
  /SCALE('Thang do TAM') ALL
  /MODEL=ALPHA
  /SUMMARY=TOTAL.

* Thang đo YD (Ý định sử dụng và khuyến nghị - 3 biến).
RELIABILITY
  /VARIABLES=YD1 YD2 YD3
  /SCALE('Thang do YD') ALL
  /MODEL=ALPHA
  /SUMMARY=TOTAL.

* --------------------------------------------------------------------.
* 2. THONG KE MO TA (MEAN, SD) THEO 2 NHOM (THUC NGHIEM VS DOI CHUNG).
* --------------------------------------------------------------------.
MEANS TABLES=SP1 SP2 SP3 SP4 SP5 TAM1 TAM2 TAM3 TAM4 TAM5 YD1 YD2 YD3 T_SOAN_LO BY NHOM
  /CELLS=MEAN COUNT STDDEV MEDIAN.

* --------------------------------------------------------------------.
* 3. KIEM DINH PHI THAM SO MANN-WHITNEY U (CHUAN CHO LIKERT 1-5).
* --------------------------------------------------------------------.
NPAR TESTS
  /M-W= SP1 SP2 SP3 SP4 SP5 TAM1 TAM2 TAM3 TAM4 TAM5 YD1 YD2 YD3 T_SOAN_LO BY NHOM(1 2)
  /STATISTICS=DESCRIPTIVES
  /MISSING ANALYSIS.

* --------------------------------------------------------------------.
* 4. KIEM DINH T-TEST DOC LAP (INDEPENDENT SAMPLES T-TEST).
* --------------------------------------------------------------------.
T-TEST GROUPS=NHOM(1 2)
  /VARIABLES=SP1 SP2 SP3 SP4 SP5 TAM1 TAM2 TAM3 TAM4 TAM5 YD1 YD2 YD3 T_SOAN_LO
  /CRITERIA=CI(.95).

* --------------------------------------------------------------------.
* 5. SO SANH TY LE PHAT HIEN LOI AO GIAC VA MUC DO SUA (CHI-SQUARE).
* --------------------------------------------------------------------.
CROSSTABS
  /TABLES=NHOM BY LOI_AO_GIAC TY_LE_SUA
  /FORMAT=AVALUE TABLES
  /STATISTICS=CHISQ
  /CELLS=COUNT ROW COLUMN TOTAL.
