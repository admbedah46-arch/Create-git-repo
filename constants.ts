
import { AppData, DoctorCategory } from './types';

const getClassToRooms = () => ({
    "Ruang Bedah - Kelas 3": ["Bedah 3A", "Bedah 3B", "Bedah 3C", "Bedah 3D", "Bedah 3E", "Bedah 3F"],
    "Ruang Bedah - Kelas 2": ["Bedah 2A", "Bedah 2B", "Bedah 2C", "Bedah 2D"],
    "Ruang Bedah - Non Kelas": ["Iso Bedah"],
    "Ruang Dane Rahil - Kelas VVIP": ["DR Super VIP 1", "DR Super VIP 2", "DR Super VIP 3"],
    "Ruang Dane Rahil - Kelas VIP": ["DR VIP 1", "DR VIP 2", "DR VIP 3", "DR VIP 4"],
    "Ruang Dane Rahil - Kelas 1": ["DR 1", "DR 2", "DR 3", "DR 4", "DR 5", "DR 6", "DR 7", "DR 8", "DR 9", "DR 10", "DR 11", "DR 12", "DR 13", "DR 14", "DR 15", "DR 16", "DR 17", "DR 18", "DR 19", "DR 20", "DR 21", "DR 22", "DR 23", "DR 24", "DR 25", "DR 26"],
    "Ruang Intermediet - Kelas HCU": ["Intermediate HCU"],
    "Ruang Intermediet - Kelas Non HCU": ["Intermediate Non HCU"],
    "Ruang Syaraf - Kelas 3": ["Syaraf A", "Syaraf B", "Syaraf C", "Syaraf D"],
    "Ruang Syaraf - Kelas 2": ["Syaraf E", "Syaraf F"],
    "Ruang Interna - Kelas 3": ["Interna 3A (Observasi)", "Interna 3B", "Interna 3C", "Interna 3D", "Interna 3E", "Interna 3F", "Interna 3G"],
    "Ruang Interna - Kelas 2": ["Interna 2A"],
    "Ruang Interna - Non Kelas": ["Interna Isolasi/Imuno"],
    "Ruang Paru - Kelas 3": ["Paru TB Resisten (RO)", "Paru Sensitif Obat (SO)", "Paru Non TB", "Paru Suspect TB1", "Paru Suspect TB2"],
    "Ruang Paru - Kelas 2": ["Paru Non TB (Kls 2)", "Paru Sensitif Obat (SO) (Kls 2)"],
    "Ruang Anak - Kelas 3": ["Anak 3A", "Anak 3B", "Anak 3C", "Anak 3D (Kulit)", "Anak 3E (Airbone)"],
    "Ruang Anak - Kelas 2": ["Anak 2A", "Anak 2B"],
    "Ruang Rinjani/Nifas - Kelas 3": ["Rinjani 1", "Rinjani 2", "Rinjani 3", "Rinjani 4", "Rinjani 5", "Rinjani 6", "Rinjani 7", "Rinjani 8", "Rinjani 9", "Rinjani 10", "Rinjani 11", "Rinjani 16 (Isolasi)"],
    "Ruang Rinjani/Nifas - Kelas 2": ["Rinjani 14", "Rinjani 15"],
    "Ruang Rinjani/Nifas - Kelas 1": ["Rinjani 12", "Rinjani 13", "Rinjani 17", "Rinjani 18"],
    "Ruang Neonatus - Non Kelas": ["NICU", "Isolasi NICU", "Ruang HCU", "Isolasi HCU", "Ruang Neonatus"],
    "OK MCC - Non Kelas": ["OK MCC"],
    "ICU - Non Kelas": ["ICU"],
    "ICCU - Non Kelas": ["ICCU"],
    "IBS - Non Kelas": ["IBS"],
    "Hemodialisa - Non Kelas": ["Hemodialisa"]
});

const classToRoomsData = getClassToRooms();
const allRoomsList = Array.from(new Set(Object.values(classToRoomsData).flat()));

// KSM yang dianggap sebagai OPERATOR
const OPERATOR_KSMS = [
  "Bedah", "Orthopedi", "Bedah Syaraf", "Onkologi", "Urologi", 
  "BTKV", "Obgyn", "THT-KL", "Mata", "Gigi & Mulut"
];

// KSM yang dianggap sebagai ANESTESI
const ANESTHESIA_KSMS = ["Anestesi"];

const rawDoctorData: Record<string, string> = {
    "dr. Aji Pramito, Sp.B": "Bedah",
    "dr. Aulia Ahimsa Martawiguna, M. Biomed., Sp.B.": "Bedah",
    "dr. Muhammad Tontowi Jauhari, Sp.B., Subsp. Onk (K)": "Onkologi",
    "dr. Raden Lyana Sulistyanti, Sp.B": "Bedah",
    "dr. Ahmad Rizan Hendrawan, Sp.OT": "Orthopedi",
    "dr. Luky Tandio Putra Sp.OT": "Orthopedi",
    "dr. Sukmawendi Triwirita Sanjaya, Sp.OT": "Orthopedi",
    "drg. Cita Darmastuti, Sp.BM": "Bedah",
    "dr. Edi Surya Bara, M.Ked.Klin, Sp.BTKV": "BTKV",
    "dr. Samudra Widagdo Arifin, Sp.U": "Urologi",
    "dr. Teuku Arie Hidayat, Sp.BS": "Bedah Syaraf",
    "dr. Sri Subekti, Sp.M,Msc": "Mata",
    "dr. Iva Rini Aryani, SpM, Msc": "Mata",
    "dr. Ni Putu Anggraeni Eka Wahyuni, Sp. THT- KL": "THT-KL",
    "dr. Dadan Rohdiana, Sp.THT-KL": "THT-KL",
    "dr. Hj. Nurkristi Permatasari Amin, Sp.P": "Paru",
    "dr. Yuris Hikman Karunia, Sp.P": "Paru",
    "dr. Dewa Ayu Gora Nusantari, Sp. JP": "Jantung",
    "dr. Hesti Wulandari, Sp.JP": "Jantung",
    "dr. Lalu Galih Pratama Rinjani, Sp.JP": "Jantung",
    "dr. Zaki Saidi, Sp.JP": "Jantung",
    "dr. H. Karsito, SpPD": "Penyakit Dalam",
    "dr. Ellen, Sp.PD": "Penyakit Dalam",
    "dr. Zakiah, Sp.PD": "Penyakit Dalam",
    "dr. Junnia Hartanadi, Sp.PD": "Penyakit Dalam",
    "dr. Wa Ode Nelly Estika, Sp.PD": "Penyakit Dalam",
    "dr. Ero Eri Angga, Sp.P.D": "Penyakit Dalam",
    "dr. Anugrah Dzucha Mubarok, Sp.P.D.": "Penyakit Dalam",
    "dr. Hj. Wikan Tyasning, Sp.PD": "Penyakit Dalam",
    "dr. Nia Krisdiantari, Sp.A": "Anak",
    "dr. Maria Christine Florens Sandra, Sp.A": "Anak",
    "dr.Oktaria Safitri,Sp.A,M.Ked.Klin": "Anak",
    "dr. Christantina Pradescha Assa, Sp.N": "Saraf",
    "dr. Safat Wahyudi, Sp.S": "Saraf",
    "dr. Dewa Ayu Citra Mahardina, Sp.N": "Saraf",
    "dr. Abdul Qadir Jaelani, Sp.An.TI": "Anestesi",
    "dr. Cahya Hendrawan D.B, Sp.An": "Anestesi",
    "dr. I Nyoman Sudiarsana,Sp.An": "Anestesi",
    "dr. Lalu Ramadlan, Sp.An-TI": "Anestesi",
    "dr. Febriana Puspita Adji, SpKJ.": "Jiwa",
    "dr. Hana Milatieka, Sp.K.F.R": "Rehab Medik",
    "dr. Tri Sundari Tika,Sp.OG": "Obgyn",
    "dr. Dewa Made Sucipta P., Sp.OG (K)": "Obgyn",
    "dr. Mohammad Khoiron Tamami, Sp.OG": "Obgyn",
    "dr. Suaidi,Sp.OG": "Obgyn",
    "dr. Lysa Mariam, Sp.KK": "Kulit & Kelamin",
    "dr. Citra Rozaaq Lahay, Sp.Rad": "Radiologi",
    "dr. Anjasmoro,Sp. Rad": "Radiologi",
    "dr. Saida Hayati, Sp.MK": "Patologi Klinis",
    "dr. Uswatun Hasanah, Sp.PA": "Patologi Anatomi",
    "dr. Mardiana Maya Utari": "Umum"
};

const initialDoctorMetadata: Record<string, { ksm: string, category: DoctorCategory }> = {};

Object.entries(rawDoctorData).forEach(([name, ksm]) => {
    let finalKsm = ksm;
    if (name.toLowerCase().startsWith("drg.")) {
        finalKsm = "Gigi & Mulut";
    }

    let category: DoctorCategory = 'NON_OPERATOR';
    if (OPERATOR_KSMS.includes(finalKsm)) {
        category = 'OPERATOR';
    } else if (ANESTHESIA_KSMS.includes(finalKsm)) {
        category = 'ANESTHESIA';
    }

    initialDoctorMetadata[name] = {
        ksm: finalKsm,
        category: category
    };
});

export const INITIAL_DATA: AppData = {
  "timestamp": new Date().toISOString(),
  "patients": [], 
  "dailyReports": [],
  "nursingReports": [],
  "operations": [],
  "incidentReports": [],
  "qualityMeasurements": [],
  "masterData": {
    "doctors": Object.keys(initialDoctorMetadata),
    "doctorMetadata": initialDoctorMetadata,
    "nurses": [
        "LALU QARIYIDDIN S. Kep, Ners.", "MUHAMMAD ABDUL ROSID, S.Kep", "Raden Teguh Pribadi,S.kep.Ns.MM", "Uswatun hasanah", "NILA SISNAWATI", "Yayuk aprianis", "SAUFIA HAYATI UMAJAN", "Joni Bahtiar", "MUHAMMAD ABDURRAHIM", "ZULKIPLI", "Baiq dian septiana", "Novi Harianto", "Lalu Dody Apriatama", "PATMAYANTI MULTISARI", "Tatia Maresta", "Wahyu hidayati", "RAIHUL JANNAH", "Mustakim,S,kep, Ns", "Nurul wahyuni", "Nomy Asyrifa", "WINDA YUNIARTI", "Erna Winarti", "Lalu surya madi", "RUSNAWINARTI, S Kep.Ns", "SRI SUYATMI LAILI AZIZAH", "Zaenal amami", "Thohry As'Ary", "DIANTI", "FIKHURRAHMAN"
    ],
    "nurseMetadata": {
        "LALU QARIYIDDIN S. Kep, Ners.": { position: "Kepala Ruangan" },
        "MUHAMMAD ABDUL ROSID, S.Kep": { position: "Sekretaris Ruangan" },
        "Raden Teguh Pribadi,S.kep.Ns.MM": { position: "PIC" },
        "Uswatun hasanah": { position: "PIC" },
        "NILA SISNAWATI": { position: "Perawat Primer" },
        "Yayuk aprianis": { position: "Perawat Primer" },
        "SAUFIA HAYATI UMAJAN": { position: "Perawat Primer" },
        "Joni Bahtiar": { position: "Perawat Pengganti" },
        "MUHAMMAD ABDURRAHIM": { position: "Perawat Pengganti" },
        "ZULKIPLI": { position: "Ketua Shift" },
        "Baiq dian septiana": { position: "Ketua Shift" },
        "Novi Harianto": { position: "Ketua Shift" },
        "Lalu Dody Apriatama": { position: "Ketua Shift" }
    },
    "users": [
      { "username": "administrator", "password": "rrr123", "role": "SUPER_ADMIN", "name": "Super User", "position": "Super User" },
      { "username": "bidang1", "password": "bidang123", "role": "BIDANG", "name": "Bidang Keperawatan", "position": "Bidang", "unit": "Semua" },
      { "username": "qori", "password": "qori123", "role": "KARU", "name": "LALU QARIYIDDIN S. Kep, Ners.", "position": "Kepala Ruangan", "unit": "Ruang Bedah" },
      { "username": "rosid", "password": "rosid12345", "role": "SEKRU", "name": "MUHAMMAD ABDUL ROSID, S.Kep", "position": "Sekretaris Ruangan", "unit": "Ruang Bedah" },
      { "username": "teguh", "password": "teguh123", "role": "PIC", "name": "Raden Teguh Pribadi,S.kep.Ns.MM", "position": "PIC", "unit": "Ruang Bedah" },
      { "username": "uswa", "password": "uswa123", "role": "PIC", "name": "Uswatun hasanah", "position": "PIC", "unit": "Ruang Bedah" },
      { "username": "nila", "password": "nila123", "role": "PPJA", "name": "NILA SISNAWATI", "position": "Perawat Primer", "unit": "Ruang Bedah" },
      { "username": "yayuk", "password": "yayuk123", "role": "PPJA", "name": "Yayuk aprianis", "position": "Perawat Primer", "unit": "Ruang Bedah" },
      { "username": "fia", "password": "fia123", "role": "PPJA", "name": "SAUFIA HAYATI UMAJAN", "position": "Perawat Primer", "unit": "Ruang Bedah" },
      { "username": "joni", "password": "joni123", "role": "STAFF", "name": "Joni Bahtiar", "position": "Perawat Pengganti", "unit": "Ruang Bedah" },
      { "username": "ahim", "password": "ahim123", "role": "STAFF", "name": "MUHAMMAD ABDURRAHIM", "position": "Perawat Pengganti", "unit": "Ruang Bedah" },
      { "username": "zul", "password": "zul123", "role": "STAFF", "name": "ZULKIPLI", "position": "Ketua Shift", "unit": "Ruang Bedah" },
      { "username": "dian", "password": "dian123", "role": "STAFF", "name": "Baiq dian septiana", "position": "Ketua Shift", "unit": "Ruang Bedah" },
      { "username": "novi", "password": "novi123", "role": "STAFF", "name": "Novi Haerani", "position": "Ketua Shift", "unit": "Ruang Bedah" },
      { "username": "ananda", "password": "ananda123", "role": "STAFF", "name": "Ananda putri cahya q", "position": "Ketua Shift", "unit": "Ruang Bedah" },
      { "username": "sufiatun", "password": "sufiatun123", "role": "STAFF", "name": "Sufiatun hadi", "position": "Perawat Assosiate", "unit": "Ruang Bedah" },
      { "username": "nurafni", "password": "nurafni123", "role": "STAFF", "name": "Nur afni kh", "position": "Perawat Assosiate", "unit": "Ruang Bedah" },
      { "username": "reni", "password": "reni123", "role": "STAFF", "name": "Reni suryani", "position": "Perawat Assosiate", "unit": "Ruang Bedah" },
      { "username": "lina", "password": "lina123", "role": "STAFF", "name": "Lina yulianti", "position": "Perawat Assosiate", "unit": "Ruang Bedah" },
      { "username": "novik", "password": "novik123", "role": "STAFF", "name": "Novi kurniawan", "position": "Perawat Assosiate", "unit": "Ruang Bedah" },
      { "username": "isnan", "password": "isnan123", "role": "STAFF", "name": "L. Muh. Isnan hadiwijaya", "position": "Perawat Assosiate", "unit": "Ruang Bedah" },
      { "username": "wahdah", "password": "wahdah123", "role": "STAFF", "name": "Wahdah fadillah", "position": "Perawat Assosiate", "unit": "Ruang Bedah" },
      { "username": "nida", "password": "nida123", "role": "STAFF", "name": "Nida", "position": "Perawat Assosiate", "unit": "Ruang Bedah" },
      { "username": "siska", "password": "siska123", "role": "STAFF", "name": "Siska ayu lestari", "position": "Perawat Assosiate", "unit": "Ruang Bedah" },
      { "username": "dianti", "password": "dianti123", "role": "STAFF", "name": "DIANTI", "position": "Perawat Assosiate", "unit": "Ruang Bedah" },
      { "username": "fiki", "password": "fiki123", "role": "STAFF", "name": "FIKHURRAHMAN", "position": "Perawat Assosiate", "unit": "Ruang Bedah" }
    ],
    "units": ["Ruang Bedah", "Ruang Dane Rahil", "Ruang Intermediet", "Ruang Syaraf", "Ruang Interna", "Ruang Paru", "Ruang Anak", "Ruang Rinjani/Nifas", "Ruang Neonatus", "ICU", "ICCU", "IBS", "OK MCC", "Hemodialisa"],
    "unitToClasses": {
        "Ruang Bedah": ["Kelas 3", "Kelas 2", "Non Kelas"],
        "Ruang Dane Rahil": ["Kelas VVIP", "Kelas VIP", "Kelas 1"],
        "Ruang Intermediet": ["Kelas HCU", "Kelas Non HCU"],
        "Ruang Syaraf": ["Kelas 3", "Kelas 2"],
        "Ruang Interna": ["Kelas 3", "Kelas 2", "Non Kelas"],
        "Ruang Paru": ["Kelas 3", "Kelas 2"],
        "Ruang Anak": ["Kelas 3", "Kelas 2"],
        "Ruang Rinjani/Nifas": ["Kelas 3", "Kelas 2", "Kelas 1"],
        "Ruang Neonatus": ["Non Kelas"],
        "ICU": ["Non Kelas"],
        "ICCU": ["Non Kelas"],
        "IBS": ["Non Kelas"],
        "OK MCC": ["Non Kelas"],
        "Hemodialisa": ["Non Kelas"]
    },
    "classToRooms": classToRoomsData,
    "roomToBeds": {
        "Bedah 3A": ["3A1", "3A2", "3A3", "3A4", "3A5", "3A6"], "Bedah 3B": ["3B1", "3B2", "3B3", "3B4", "3B5", "3B6"], "Bedah 3C": ["3C1", "3C2", "3C3", "3C4", "3C5", "3C6"], "Bedah 3D": ["3D1", "3D2", "3D3", "3D4", "3D5", "3D6"], "Bedah 3E": ["3E1", "3E2", "3E3", "3E4", "3E5", "3E6"], "Bedah 3F": ["3F1", "3F2", "3F3", "3F4"], "Bedah 2A": ["2A1", "2A2"], "Bedah 2B": ["2B1", "2B2"], "Bedah 2C": ["2C1", "2C2"], "Bedah 2D": ["2D1", "2D2", "2D3"], "Iso Bedah": ["Iso 1", "Iso 2", "Iso 3"],
        "DR Super VIP 1": ["DR Super VIP 1"], "DR Super VIP 2": ["DR Super VIP 2"], "DR Super VIP 3": ["DR Super VIP 3"], "DR VIP 1": ["DR VIP 1"], "DR VIP 2": ["DR VIP 2"], "DR VIP 3": ["DR VIP 3"], "DR VIP 4": ["DR VIP 4"], "DR 1": ["DR 1"], "DR 2": ["DR 2"], "DR 3": ["DR 3"], "DR 4": ["DR 4"], "DR 5": ["DR 5"], "DR 6": ["DR 6"], "DR 7": ["DR 7"], "DR 8": ["DR 8"], "DR 9": ["DR 9"], "DR 10": ["DR 10"], "DR 11": ["DR 11"], "DR 12": ["DR 12"], "DR 13": ["DR 13"], "DR 14": ["DR 14"], "DR 15": ["DR 15"], "DR 16": ["DR 16"], "DR 17": ["DR 17"], "DR 18": ["DR 18"], "DR 19": ["DR 19"], "DR 20": ["DR 20"], "DR 21": ["DR 21"], "DR 22": ["DR 22"], "DR 23": ["DR 23"], "DR 24": ["DR 24"], "DR 25": ["DR 25"], "DR 26": ["DR 26"],
        "Intermediate HCU": ["Intermediate HCU Bed 1", "Intermediate HCU Bed 2", "Intermediate HCU Bed 3"], "Intermediate Non HCU": ["Intermediate Non HCU Bed 1", "Intermediate Non HCU Bed 2", "Intermediate Non HCU Bed 3", "Intermediate Non HCU Bed 4", "Intermediate Non HCU Bed 5", "Intermediate Non HCU Bed 6"],
        "Syaraf A": ["A1", "A2", "A3", "A4"], "Syaraf B": ["B1", "B2", "B3", "B4"], "Syaraf C": ["C1", "C2", "C3", "C4"], "Syaraf D": ["D1", "D2", "D3", "D4"], "Syaraf E": ["E1", "E2"], "Syaraf F": ["F1", "F2", "F3"],
        "Interna 3A (Observasi)": ["3A1", "3A2", "3A3", "3A4", "3A5"], "Interna 3B": ["3B1", "3B2", "3B3", "3B4", "3B5"], "Interna 3C": ["3C1", "3C2", "3C3", "3C4", "3C5"], "Interna 3D": ["3D1", "3D2", "3D3"], "Interna 3E": ["3E1", "3E2", "3E3", "3E4"], "Interna 3F": ["3F1", "3F2", "3F3", "3F4", "3F5", "3F6"], "Interna 3G": ["3G1", "3G2", "3G3", "3G4", "3G5", "3G5"], "Interna 2A": ["2A1", "2A2", "2A3", "2A4"], "Interna Isolasi/Imuno": ["Iso 1", "Iso 2", "Iso 3", "Iso 4"],
        "Paru TB Resisten (RO)": ["Bed 1", "Bed 2"], "Paru Sensitif Obat (SO)": ["Bed 1", "Bed 2", "Bed 3", "Bed 4", "Bed 5", "Bed 6"], "Paru Non TB": ["Bed 1", "Bed 2", "Bed 3", "Bed 4", "Bed 5", "Bed 6"], "Paru Suspect TB1": ["Bed 1", "Bed 2", "Bed 3", "Bed 4"], "Paru Suspect TB2": ["Bed 1", "Bed 2", "Bed 3", "Bed 4"], "Paru Non TB (Kls 2)": ["Bed 1", "Bed 2"], "Paru Sensitif Obat (SO) (Kls 2)": ["Bed 1", "Bed 2"],
        "Anak 3A": ["3A1", "3A2", "3A3", "3A4", "3A5", "3A6", "3A7", "3A8"], "Anak 3B": ["3B1", "3B2", "3B3", "3B4", "3B5", "3B6", "3B7", "3B8"], "Anak 3C": ["3C1", "3C2", "3C3", "3C4", "3C5", "3C6", "3C7", "3C8"], "Anak 3D (Kulit)": ["3D1", "3D2"], "Anak 3E (Airbone)": ["3E1", "3E2", "3E3", "3E4"], "Anak 2A": ["2A1", "2A2"], "Anak 2B": ["2B1", "2B2"],
        "Rinjani 1": ["Rinjani 1 Bed 1", "Rinjani 1 Bed 2", "Rinjani 1 Bed 3"], "Rinjani 2": ["Rinjani 2 Bed 1", "Rinjani 2 Bed 2", "Rinjani 2 Bed 3"], "Rinjani 3": ["Rinjani 3 Bed 1", "Rinjani 3 Bed 2", "Rinjani 3 Bed 3"], "Rinjani 4": ["Rinjani 4 Bed 1", "Rinjani 4 Bed 2", "Rinjani 4 Bed 3"], "Rinjani 5": ["Rinjani 5 Bed 1", "Rinjani 5 Bed 2", "Rinjani 5 Bed 3"], "Rinjani 6": ["Rinjani 6 Bed 1", "Rinjani 6 Bed 2", "Rinjani 6 Bed 3"], "Rinjani 7": ["Rinjani 7 Bed 1", "Rinjani 7 Bed 2", "Rinjani 7 Bed 3"], "Rinjani 8": ["Rinjani 8 Bed 1", "Rinjani 8 Bed 2", "Rinjani 8 Bed 3"], "Rinjani 9": ["Rinjani 9 Bed 1", "Rinjani 9 Bed 2", "Rinjani 9 Bed 3"], "Rinjani 10": ["Rinjani 10 Bed 1", "Rinjani 10 Bed 2", "Rinjani 10 Bed 3"], "Rinjani 11": ["Rinjani 11 Bed 1", "Rinjani 11 Bed 2", "Rinjani 11 Bed 3"], "Rinjani 16 (Isolasi)": ["Rinjani 16 (Isolasi) Bed 1", "Rinjani 16 (Isolasi) Bed 2"], "Rinjani 14": ["Rinjani 14 Bed 1", "Rinjani 14 Bed 2"], "Rinjani 15": ["Rinjani 15 Bed 1", "Rinjani 15 Bed 2"], "Rinjani 12": ["Rinjani 12"], "Rinjani 13": ["Rinjani 13"], "Rinjani 17": ["Rinjani 17"], "Rinjani 18": ["Rinjani 18"],
        "NICU": ["NICU Bed 1", "NICU Bed 2", "NICU Bed 3", "NICU Bed 4"], "Isolasi NICU": ["Isolasi NICU Bed 1", "Isolasi NICU Bed 2", "Isolasi NICU Bed 3", "Isolasi NICU Bed 4"], "Ruang HCU": ["HCU Bed 1", "HCU Bed 2", "HCU Bed 3", "HCU Bed 4", "HCU Bed 5"], "Isolasi HCU": ["Isolasi HCU Bed 1", "Isolasi HCU Bed 2", "Isolasi HCU Bed 3"], "Ruang Neonatus": ["Neonatus Bed 1", "Neonatus Bed 2", "Neonatus Bed 3", "Neonatus Bed 4", "Neonatus Bed 5", "Neonatus Bed 6", "Neonatus Bed 7", "Neonatus Bed 8", "Neonatus Bed 9", "Neonatus Bed 10", "Neonatus Bed 11", "Neonatus Bed 12", "Neonatus Bed 13", "Neonatus Bed 14"],
        "OK MCC": ["OK MCC 1", "OK MCC 2", "OK MCC 3"], "ICU": ["ICU Bed 1", "ICU Bed 2", "ICU Bed 3", "ICU Bed 4", "ICU Bed 5", "ICU Bed 6", "ICU Bed 7", "ICU Bed 8", "ICU Bed 9", "ICU Bed 10", "ICU Bed 11"], "ICCU": ["ICCU Bed 1", "ICCU Bed 2", "ICCU Bed 3", "ICCU Bed 4", "ICCU Bed 5", "ICCU Bed 6", "ICCU Bed 7"], "IBS": ["IBS 1", "IBS 2", "IBS 3", "IBS 4", "IBS 5", "IBS 6", "IBS 7", "IBS 8", "IBS 9", "IBS 10"], "Hemodialisa": ["HD 1", "HD 2", "HD 3", "HD 4", "HD 5", "HD 6", "HD 7", "HD 8", "HD 9", "HD 10", "HD 11", "HD 12", "HD 13", "HD 14", "HD 15", "HD 16", "HD 17", "HD 18", "HD 19", "HD 20", "HD 21", "HD 22", "HD 23", "HD 24", "HD 25", "HD 26", "HD 27", "HD 28", "HD 29", "HD 30", "HD 31", "HD 32", "HD 33"]
    },
    rooms: allRoomsList,
    roomClasses: [],
    bedMapping: {},
    addresses: [],
    customFields: [],
    qualityIndicators: [
      {
        id: 'inm-1',
        title: 'Kepatuhan Kebersihan Tangan',
        numerator: 'Jumlah peluang kebersihan tangan yang dilakukan',
        denominator: 'Jumlah peluang kebersihan tangan yang diamati',
        target: 85,
        unit: '%',
        frequency: 'MONTHLY',
        category: 'INM'
      },
      {
        id: 'inm-2',
        title: 'Kepatuhan Penggunaan APD',
        numerator: 'Jumlah petugas yang menggunakan APD lengkap',
        denominator: 'Jumlah petugas yang diamati',
        target: 100,
        unit: '%',
        frequency: 'MONTHLY',
        category: 'INM'
      },
      {
        id: 'inm-3',
        title: 'Kepatuhan Identifikasi Pasien',
        numerator: 'Jumlah proses identifikasi yang dilakukan dengan benar',
        denominator: 'Jumlah proses identifikasi yang diamati',
        target: 100,
        unit: '%',
        frequency: 'DAILY',
        category: 'INM'
      },
      {
        id: 'inm-4',
        title: 'Waktu Tunggu Operasi Elektif',
        numerator: 'Jumlah pasien operasi elektif dengan waktu tunggu < 2 hari',
        denominator: 'Jumlah seluruh pasien operasi elektif',
        target: 80,
        unit: '%',
        frequency: 'MONTHLY',
        category: 'INM'
      }
    ],
    refs: {
      positions: ["Super User", "Kepala Ruangan", "Sekretaris Ruangan", "PIC", "Perawat Primer", "Perawat Pengganti", "Ketua Shift", "Perawat Assosiate", "Administrasi"],
      ksmList: ["Bedah", "Orthopedi", "Bedah Syaraf", "Onkologi", "Urologi", "BTKV", "Penyakit Dalam", "Anak", "Obgyn", "Saraf", "Anestesi", "THT-KL", "Mata", "Jantung", "Paru", "Umum", "Radiologi", "Patologi Klinis", "Patologi Anatomi", "Jiwa", "Rehab Medik", "Kulit & Kelamin", "Gigi & Mulut", "Lainnya"],
      asalMasuk: ["IGD", "IGD Ponek", "P. Bedah", "P. Orthopedi", "P. Bedah Syaraf", "P. Bedah Onkologi", "P. Bedah Mulut", "P. BTKV", "P. Urologi", "P. THT", "P. Mata", "P. Anak", "P. Kulit & Kelamin", "P. Dalam", "P. Jantung", "P. Syaraf", "P. Obgyn", "P. Fetomaternal", "P. Jiwa", "Ruang Bedah", "Ruang Dane Rahil", "Ruang Intermediet", "Ruang Syaraf", "Ruang Interna", "Ruang Rinjani/Nifas", "Ruang Paru", "Ruan Anak", "Ruang Neonatus", "IBS", "ICU", "CVCU", "Hemodialisa", "OK MCC"],
      jenisKll: ["Bukan KLL", "KLL Tunggal", "KLL Ganda", "KLL ditabarak", "KLL JR Maks", "Kecelakaan Kerja", "-"],
      caraBayar: ["BPJS", "Jasa Raharja (JR)", "Umum", "BPJS Ketenagakerjaan", "Tanggungan Negara", "Baksos", "Asuransi Swasta", "Lain-lain"],
      statusTanggungan: ["Menjaminkan", "BPJS", "Jasa Raharja (JR)", "Umum", "BPJS Ketenagakerjaan", "Tanggungan Negara", "Baksos", "Asuransi Swasta", "Lain-lain"],
      statusSep: ["Belum Terbit", "Sudah Terbit", "Pending", "Ditolak", "Hapus SEP", "Tidak Ada SEP"],
      statusDataPasien: ["Masih Dirawat", "Sudah Pulang", "APS", "Dirujuk", "Dipindah ke Ruangan Lain"],
      caraKeluar: ["BPL (Boleh Pulang)", "APS (Pulang Paksa)", "Dirujuk", "Meninggal", "Dipindah ke Ruangan Lain"]
    }
  }
};
