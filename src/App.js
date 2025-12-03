import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken 
} from 'firebase/auth';
import { 
  ClipboardList, User, Settings, LogOut, FileSpreadsheet, CheckCircle, 
  Truck, Factory, FileText, PlusCircle, AlertCircle, Lock 
} from 'lucide-react';

// --- Firebase Configuration ---
// [중요] 실제 운영 시에는 본인의 Firebase 키값으로 변경해야 합니다.
const firebaseConfig = {
  apiKey: "AIzaSyDOgzHZvBtzuCayxuEB9hMPJ4BBlvhvHtw",
  authDomain: "mes-worklog-system.firebaseapp.com",
  projectId: "mes-worklog-system",
  storageBucket: "mes-worklog-system.firebasestorage.app",
  messagingSenderId: "662704876600",
  appId: "1:662704876600:web:1a92d6e8d5c4cd99a7cacd",
  measurementId: "G-8XRXFQ7HV4"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Constants & Helper Functions ---
const VEHICLE_MODELS = ['DN8', 'LF', 'DE', 'J100', 'J120', 'O100', 'GN7'];
const PROCESS_TYPES = ['소재준비', '프레스', '후가공', '검사'];

const isKGM = (model) => ['J100', 'O100', 'J120'].includes(model);

const getLogTitle = (model, process) => {
  if (!model || !process) return '작업일보';
  switch (process) {
    case '소재준비':
      if (model === 'J100' || model === 'GN7') return `${model} 소재준비`;
      return `소재준비 ${model}`;
    case '프레스':
      if (isKGM(model)) return 'KGM 프레스';
      return `${model} 프레스`;
    case '후가공':
      return '후가공일보';
    case '검사':
      if (isKGM(model)) return 'KGM 검사일보';
      return `검사일보 ${model}`;
    default:
      return `${model} ${process} 일보`;
  }
};

// --- Form Templates (엑셀 양식 모사) ---
const FORM_TEMPLATES = {
  // 1. 소재준비 (Material)
  material: {
    columns: [
      { key: 'qty', label: '작업수량', type: 'number' },
      { key: 'spec_start', label: '초물(길이)', type: 'text' },
      { key: 'spec_mid', label: '중물(길이)', type: 'text' },
      { key: 'spec_end', label: '종물(길이)', type: 'text' },
      { key: 'lot', label: 'Lot No', type: 'text' }
    ],
    rows: (model) => {
      if (['J100', 'J120', 'O100'].includes(model)) return ['J100 RR', 'J120', 'O100', '기타'];
      if (model === 'GN7') return ['FRT', 'RR', '기타'];
      return ['FRT', 'RR', 'LF A', 'DE FRT', '기타']; // DN8 등 기본값
    }
  },
  // 2. 프레스 (Press) - LOT 필드 4가지(A,B,C,D) 적용
  press: {
    columns: [
      { key: 'mold_no', label: '금형No', type: 'text' },
      { key: 'lot_a', label: 'A소재 LOT', type: 'text' },
      { key: 'lot_b', label: 'B소재 LOT', type: 'text' },
      { key: 'lot_c', label: 'C소재 LOT', type: 'text' },
      { key: 'lot_d', label: 'D소재 LOT', type: 'text' },
      { key: 'qty', label: '생산수량', type: 'number' },
      { key: 'defect_drop', label: '떨어짐', type: 'number', isDefect: true },
      { key: 'defect_push', label: '밀림', type: 'number', isDefect: true },
      { key: 'defect_step', label: '단차', type: 'number', isDefect: true },
      { key: 'defect_short', label: '양부족', type: 'number', isDefect: true },
      { key: 'defect_bubble', label: '기포', type: 'number', isDefect: true },
    ],
    rows: () => ['FRT LH', 'FRT RH', 'RR LH', 'RR RH']
  },
  // 3. 후가공 (Post-processing) - LOT 필드 4가지 추가
  post: {
    columns: [
      { key: 'qty', label: '생산수량', type: 'number' },
      { key: 'lot_a', label: 'A소재 LOT', type: 'text' },
      { key: 'lot_b', label: 'B소재 LOT', type: 'text' },
      { key: 'lot_c', label: 'C소재 LOT', type: 'text' },
      { key: 'lot_d', label: 'D소재 LOT', type: 'text' },
      { key: 'defect_finish', label: '사상불량', type: 'number', isDefect: true },
      { key: 'defect_trans', label: '운반파손', type: 'number', isDefect: true },
      { key: 'defect_poll', label: '외면오염', type: 'number', isDefect: true },
    ],
    rows: () => ['FRT LH', 'FRT RH', 'RR LH', 'RR RH']
  },
  // 4. 검사 (Inspection) - LOT 필드 4가지 추가
  inspection: {
    columns: [
      { key: 'check_qty', label: '검사수량', type: 'number' },
      { key: 'lot_a', label: 'A소재 LOT', type: 'text' },
      { key: 'lot_b', label: 'B소재 LOT', type: 'text' },
      { key: 'lot_c', label: 'C소재 LOT', type: 'text' },
      { key: 'lot_d', label: 'D소재 LOT', type: 'text' },
      { key: 'dim_start', label: '치수(초)', type: 'text' },
      { key: 'dim_mid', label: '치수(중)', type: 'text' },
      { key: 'dim_end', label: '치수(종)', type: 'text' },
      { key: 'defect_total', label: '불량수량', type: 'number', isDefect: true }
    ],
    rows: (model) => {
      if (isKGM(model)) return ['J100 L/R', 'J120 L/R', 'O100 L/R'];
      return ['FRT LH', 'FRT RH', 'RR LH', 'RR RH'];
    }
  }
};

const getFormType = (process) => {
  if (process.includes('소재')) return 'material';
  if (process.includes('프레스')) return 'press';
  if (process.includes('후가공')) return 'post';
  if (process.includes('검사')) return 'inspection';
  return 'material'; // fallback
};

// CSV Export Logic (Expanded for detailed rows)
const exportToCSV = (data) => {
  if (!data || data.length === 0) {
    alert("내보낼 데이터가 없습니다.");
    return;
  }

  // Collect all unique keys from details for dynamic columns
  const allDetailKeys = new Set();
  data.forEach(row => {
    if (row.details) {
      Object.keys(row.details).forEach(rowKey => {
        Object.keys(row.details[rowKey]).forEach(colKey => {
          allDetailKeys.add(`${rowKey}_${colKey}`);
        });
      });
    }
  });
  
  const detailHeaders = Array.from(allDetailKeys).sort();
  const baseHeaders = ['날짜', '작업자', '차종', '공정', '일보명', '총생산수량', '총불량수량', '특이사항'];
  
  const csvRows = [[...baseHeaders, ...detailHeaders].join(',')];

  data.forEach(row => {
    const baseValues = [
      new Date(row.timestamp?.seconds * 1000).toLocaleDateString(),
      `"${row.workerName}"`,
      `"${row.vehicleModel}"`,
      `"${row.processType}"`,
      `"${row.logTitle}"`,
      row.productionQty || 0,
      row.defectQty || 0,
      `"${row.notes || ''}"`
    ];

    const detailValues = detailHeaders.map(header => {
      const [rowKey, colKey] = header.split(/_(.+)/); // Split only on first underscore
      return row.details?.[rowKey]?.[colKey] || '';
    });

    csvRows.push([...baseValues, ...detailValues].join(','));
  });

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `작업일보_통합_${new Date().toLocaleDateString()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- Components ---

const LoginScreen = ({ onLogin }) => {
  const [role, setRole] = useState('worker');
  const [name, setName] = useState(''); // For worker
  const [adminId, setAdminId] = useState(''); // For admin
  const [password, setPassword] = useState(''); // For admin
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (role === 'worker') {
      if (name.trim()) {
        onLogin({ name, role });
      } else {
        setError('이름을 입력해주세요.');
      }
    } else {
      // Simple Mock Validation for Admin
      if (adminId === 'admin' && password === '1234') {
        onLogin({ name: '관리자', role });
      } else {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-100 p-3 rounded-full">
            <ClipboardList className="w-10 h-10 text-blue-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">MES 시스템 로그인</h2>
        <p className="text-center text-gray-500 mb-6">접속 권한을 선택하세요</p>
        
        {/* Role Selection Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
          <button
            type="button"
            onClick={() => { setRole('worker'); setError(''); }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition duration-200 flex items-center justify-center gap-2 ${
              role === 'worker' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <User size={16} /> 작업자
          </button>
          <button
            type="button"
            onClick={() => { setRole('admin'); setError(''); }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition duration-200 flex items-center justify-center gap-2 ${
              role === 'admin' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings size={16} /> 관리자
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {role === 'worker' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">작업자 성명</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder="이름을 입력하세요"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">관리자 아이디</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    required
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                    placeholder="아이디 (admin)"
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    required
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                    placeholder="비밀번호 (1234)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            className={`w-full font-bold py-3 rounded-lg mt-2 shadow-sm transition text-white
              ${role === 'worker' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-600 hover:bg-indigo-700'}
            `}
          >
            {role === 'worker' ? '작업 시작하기' : '관리자 접속'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Dynamic Form Component ---
const DynamicTableForm = ({ vehicle, processType, onChange }) => {
  const formType = getFormType(processType);
  const template = FORM_TEMPLATES[formType];
  const rowLabels = template.rows(vehicle);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    // Reset data when vehicle/process changes
    setFormData({});
    onChange({}, 0, 0); 
  }, [vehicle, processType]);

  const handleCellChange = (rowLabel, colKey, value, isDefect, colType) => {
    const newData = { ...formData };
    if (!newData[rowLabel]) newData[rowLabel] = {};
    
    // Convert to number if input type is number
    const finalValue = colType === 'number' ? (Number(value) || 0) : value;
    newData[rowLabel][colKey] = finalValue;
    setFormData(newData);

    // Calculate totals
    let totalQty = 0;
    let totalDefect = 0;

    Object.keys(newData).forEach(r => {
      Object.keys(newData[r]).forEach(c => {
        const val = newData[r][c];
        const colDef = template.columns.find(col => col.key === c);
        if (colDef?.key === 'qty' || colDef?.key === 'check_qty') totalQty += val;
        if (colDef?.isDefect) totalDefect += val;
      });
    });

    onChange(newData, totalQty, totalDefect);
  };

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm text-left text-gray-500 min-w-[600px]">
        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
          <tr>
            <th className="px-4 py-3 sticky left-0 bg-gray-100 z-10">구분</th>
            {template.columns.map(col => (
              <th key={col.key} className="px-4 py-3 min-w-[100px] text-center whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map(rowLabel => (
            <tr key={rowLabel} className="bg-white border-b hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900 sticky left-0 bg-white z-10 border-r">
                {rowLabel}
              </td>
              {template.columns.map(col => (
                <td key={col.key} className="px-2 py-2 text-center">
                  <input
                    type={col.type === 'number' ? 'number' : 'text'}
                    min={col.type === 'number' ? "0" : undefined}
                    className={`w-full p-2 border rounded text-center focus:ring-2 outline-none transition
                      ${col.isDefect ? 'border-red-200 focus:ring-red-500 bg-red-50' : 'border-gray-200 focus:ring-blue-500'}
                    `}
                    placeholder={col.type === 'number' ? '0' : '-'}
                    onChange={(e) => handleCellChange(rowLabel, col.key, e.target.value, col.isDefect, col.type)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const WorkerDashboard = ({ user, db, appId }) => {
  const [vehicle, setVehicle] = useState('');
  const [processType, setProcessType] = useState('');
  const [notes, setNotes] = useState('');
  const [formDetails, setFormDetails] = useState({});
  const [totalQty, setTotalQty] = useState(0);
  const [totalDefect, setTotalDefect] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const logTitle = useMemo(() => getLogTitle(vehicle, processType), [vehicle, processType]);

  const handleFormChange = (details, qty, defect) => {
    setFormDetails(details);
    setTotalQty(qty);
    setTotalDefect(defect);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vehicle || !processType) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'work_logs_v2'), {
        workerName: user.name,
        vehicleModel: vehicle,
        processType: processType,
        logTitle: logTitle,
        details: formDetails, // Store the complex table data
        productionQty: totalQty,
        defectQty: totalDefect,
        notes: notes,
        timestamp: serverTimestamp(),
      });
      
      setSubmitSuccess(true);
      setNotes('');
      // Force reset details by remounting or clearing via key if needed
      setVehicle(''); 
      setProcessType('');
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText size={20} />
              작업일보 작성
            </h2>
            <p className="text-blue-100 text-xs mt-1">작업자: {user.name}</p>
          </div>
          <div className="bg-blue-700 px-3 py-1 rounded text-sm font-bold">
            {new Date().toLocaleDateString()}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Top Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">차종</label>
              <div className="relative">
                <select
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">차종 선택</option>
                  {VEHICLE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <Truck className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">공정</label>
              <div className="relative">
                <select
                  value={processType}
                  onChange={(e) => setProcessType(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">공정 선택</option>
                  {PROCESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <Factory className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Dynamic Form Area */}
          {vehicle && processType ? (
            <div className="animate-fade-in space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2 text-blue-800 font-bold text-lg">
                  <ClipboardList className="w-6 h-6" />
                  {logTitle}
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="font-semibold text-gray-600">총 생산: <span className="text-blue-600">{totalQty}</span></span>
                  <span className="font-semibold text-gray-600">총 불량: <span className="text-red-600">{totalDefect}</span></span>
                </div>
              </div>

              <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                <div className="mb-2 text-xs text-gray-500 flex items-center gap-1">
                  <AlertCircle size={12} />
                  <span>아래 표에 세부 내용을 입력하세요. 합계는 자동 계산됩니다.</span>
                </div>
                <DynamicTableForm 
                  vehicle={vehicle} 
                  processType={processType} 
                  onChange={handleFormChange} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">특이사항</label>
                <textarea
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  placeholder="작업 중 특이사항 입력"
                ></textarea>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`w-full py-4 rounded-lg font-bold text-white shadow-md transition flex items-center justify-center gap-2 text-lg
                  ${isSubmitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}
                `}
              >
                {isSubmitting ? '저장 중...' : '일보 등록 완료'}
                {!isSubmitting && <PlusCircle size={24} />}
              </button>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-400">
              차종과 공정을 선택하면<br/>맞춤형 작업일보 양식이 나타납니다.
            </div>
          )}
        </div>
      </div>

      {submitSuccess && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 animate-bounce z-50">
          <CheckCircle size={24} />
          <div>
            <h4 className="font-bold">등록 완료!</h4>
            <p className="text-xs text-green-100">데이터가 성공적으로 저장되었습니다.</p>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminDashboard = ({ db, appId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'work_logs_v2'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(logsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, appId]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">관리자 대시보드</h2>
          <p className="text-gray-500 text-sm">등록된 모든 작업일보를 조회하고 엑셀로 다운로드합니다.</p>
        </div>
        
        <button
          onClick={() => exportToCSV(logs)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition shadow-md"
        >
          <FileSpreadsheet size={20} />
          상세 데이터 엑셀 다운로드
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3">날짜</th>
                <th className="px-6 py-3">작업자</th>
                <th className="px-6 py-3">일보명</th>
                <th className="px-6 py-3 text-right">총생산</th>
                <th className="px-6 py-3 text-right">총불량</th>
                <th className="px-6 py-3">특이사항</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center">로딩 중...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center">데이터가 없습니다.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4">{new Date(log.timestamp?.seconds * 1000).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-medium">{log.workerName}</td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded mr-2">{log.vehicleModel}</span>
                      {log.logTitle}
                    </td>
                    <td className="px-6 py-4 text-right font-bold">{log.productionQty}</td>
                    <td className="px-6 py-4 text-right text-red-600 font-bold">{log.defectQty > 0 ? log.defectQty : '-'}</td>
                    <td className="px-6 py-4 truncate max-w-xs">{log.notes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    
    const storedUser = localStorage.getItem('workLogUser');
    if (storedUser) setCurrentUser(JSON.parse(storedUser));
    setInitializing(false);
  }, []);

  const handleLogin = (userInfo) => {
    setCurrentUser(userInfo);
    localStorage.setItem('workLogUser', JSON.stringify(userInfo));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('workLogUser');
  };

  if (initializing) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      {!currentUser ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <div className="flex flex-col min-h-screen">
          <header className="bg-white shadow-sm border-b sticky top-0 z-20">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-blue-600 p-1.5 rounded text-white"><Factory size={20} /></div>
                <h1 className="text-xl font-bold text-gray-800">스마트 작업일보</h1>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium bg-gray-100 px-3 py-1 rounded-full">
                  {currentUser.name} ({currentUser.role === 'admin' ? '관리자' : '작업자'})
                </span>
                <button onClick={handleLogout} className="text-gray-500 hover:text-red-600">
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </header>
          <main className="flex-1 max-w-7xl mx-auto w-full p-4">
            {currentUser.role === 'admin' ? (
              <AdminDashboard db={db} appId={appId} />
            ) : (
              <WorkerDashboard user={currentUser} db={db} appId={appId} />
            )}
          </main>
        </div>
      )}
    </div>
  );
}