import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Train, 
  Download, 
  Trash2, 
  MapPin, 
  Navigation, 
  History, 
  LogOut, 
  Shield, 
  Plus, 
  Calendar, 
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const BASE_ADDRESS = '福島県郡山市朝日一丁目23-7';

interface ExpenseRecord {
  id: string;
  date: string;
  destination: string;
  route: string;
  distance: number;
  is_round_trip: boolean;
  amount: number;
  person_name: string;
  user_id?: string;
  created_at?: string;
}

export function TransportationExpenses({ user }: { user: any }) {
  // Auth & Profile state
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Form state
  const [personName, setPersonName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [origin, setOrigin] = useState('事業所');
  const [originAddress, setOriginAddress] = useState(BASE_ADDRESS);
  const [destination, setDestination] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [route, setRoute] = useState('');
  const [distance, setDistance] = useState<number>(0);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [amount, setAmount] = useState(0);

  // Google Maps state
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState('');
  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);

  // List state
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 初期化: プロフィール取得
  useEffect(() => {
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (!error && data) {
        setUserProfile(data);
        setIsAdmin(data.role === 'admin');
        if (!personName) {
           setPersonName(data.email?.split('@')[0] || '');
        }
      }
    };
    fetchProfile();
  }, [user.id]);

  // Google Places Autocomplete の初期化
  useEffect(() => {
    if (window.google) {
      if (originInputRef.current) {
        const originAutocomplete = new window.google.maps.places.Autocomplete(originInputRef.current, { componentRestrictions: { country: 'jp' }, fields: ['formatted_address', 'name'] });
        originAutocomplete.addListener('place_changed', () => {
          const place = originAutocomplete.getPlace();
          if (place && place.formatted_address) {
            setOrigin(place.name || place.formatted_address);
            setOriginAddress(place.formatted_address);
          }
        });
      }
      if (destinationInputRef.current) {
        const destAutocomplete = new window.google.maps.places.Autocomplete(destinationInputRef.current, { componentRestrictions: { country: 'jp' }, fields: ['formatted_address', 'name'] });
        destAutocomplete.addListener('place_changed', () => {
          const place = destAutocomplete.getPlace();
          if (place && place.formatted_address) {
            setDestination(place.name || place.formatted_address);
            setDestinationAddress(place.formatted_address);
            calculateDistance(originAddress, place.formatted_address);
          }
        });
      }
    }
  }, [originAddress]);

  // Auto-calculation logic (amount)
  useEffect(() => {
    const calcAmount = Math.round(distance * 20 * (isRoundTrip ? 2 : 1));
    setAmount(calcAmount);
  }, [distance, isRoundTrip]);

  useEffect(() => {
    fetchExpenses();
  }, [currentMonth, isAdmin]);

  const calculateDistance = (src: string, dest: string) => {
    if (!window.google) return;
    setCalculating(true);
    setCalcError('');
    const service = new window.google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      { origins: [src], destinations: [dest], travelMode: window.google.maps.TravelMode.DRIVING },
      (response, status) => {
        setCalculating(false);
        if (status === 'OK' && response) {
          const element = response.rows[0]?.elements[0];
          if (element?.status === 'OK' && element.distance) {
            const km = Math.round(element.distance.value / 100) / 10;
            setDistance(km);
            setRoute(`${element.distance.text} / ${element.duration?.text || ''}`);
          }
        }
      }
    );
  };

  const handleCalcDistance = () => {
    if (originAddress && destinationAddress) calculateDistance(originAddress, destinationAddress);
  };

  const fetchExpenses = async () => {
    setLoading(true);
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString();
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).toISOString();

    let query = supabase.from('transportation_expenses').select('*');
    if (!isAdmin) {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)
      .order('date', { ascending: false });

    if (!error && data) setExpenses(data as ExpenseRecord[]);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName || !destination || amount <= 0) return;

    setSaving(true);
    const { error } = await supabase.from('transportation_expenses').insert([{
      user_id: user.id,
      person_name: personName,
      date,
      destination: `${origin} 〜 ${destination}`,
      route,
      distance,
      is_round_trip: isRoundTrip,
      amount
    }]);

    if (!error) {
      setDestination('');
      setDistance(0);
      setIsRoundTrip(false);
      fetchExpenses();
      alert('保存しました！');
    }
    setSaving(false);
  };

  const deleteExpense = async (id: string) => {
    if (!window.confirm('この記録を削除しますか？')) return;
    const { error } = await supabase.from('transportation_expenses').delete().eq('id', id);
    if (!error) fetchExpenses();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const exportToExcel = async () => {
    if (expenses.length === 0) {
      alert('書き出すデータがありません。');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const thinBorder: Partial<ExcelJS.Borders> = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      const groupedByDay = expenses.reduce((acc, exp) => {
        const d = new Date(exp.date).getDate().toString();
        if (!acc[d]) acc[d] = [];
        acc[d].push(exp);
        return acc;
      }, {} as Record<string, ExpenseRecord[]>);

      Object.entries(groupedByDay).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([day, dayExpenses]) => {
        const sheet = workbook.addWorksheet(day);
        sheet.columns = [ { width: 3 }, { width: 10 }, { width: 18 }, { width: 10 }, { width: 25 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 8 }, { width: 10 }, { width: 10 }, { width: 10 } ];
        sheet.mergeCells('B1:L2');
        const titleCell = sheet.getCell('B1');
        titleCell.value = '交通費精算書';
        titleCell.font = { size: 24, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getCell('B3').value = '社員番号'; sheet.getCell('B3').border = thinBorder;
        sheet.mergeCells('C3:E3'); sheet.getCell('C3').border = thinBorder;
        sheet.getCell('B4').value = '氏名'; sheet.getCell('B4').border = thinBorder;
        sheet.mergeCells('C4:E4'); sheet.getCell('C4').value = dayExpenses[0].person_name || '';
        sheet.getCell('C4').alignment = { horizontal: 'center' }; sheet.getCell('C4').border = thinBorder;
        sheet.mergeCells('I3:J3'); sheet.getCell('I3').value = 'No :';
        sheet.mergeCells('K3:L3'); sheet.getCell('K3').value = day; sheet.getCell('K3').border = { bottom: { style: 'thin' } };
        sheet.mergeCells('I4:J4'); sheet.getCell('I4').value = '申請日 :';
        sheet.mergeCells('K4:L4'); sheet.getCell('K4').value = dayExpenses[0].date; sheet.getCell('K4').border = { bottom: { style: 'thin' } };
        const headerRow = 10;
        sheet.mergeCells('E10:H10'); sheet.mergeCells('I10:K10');
        [{ col: 'B', text: '日付' }, { col: 'C', text: '行先' }, { col: 'D', text: '利用路線' }, { col: 'E', text: '区間' }, { col: 'I', text: '距離' }, { col: 'L', text: '金額' }].forEach(h => {
          const cell = sheet.getCell(`${h.col}${headerRow}`);
          cell.value = h.text; cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = thinBorder; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        });
        let currentRow = 11;
        let dayTotalDistance = 0; let dayTotalAmount = 0;
        dayExpenses.forEach((exp) => {
          const tripCount = exp.is_round_trip ? 2 : 1;
          const [start, end] = exp.destination.split(' 〜 ');
          for (let i = 0; i < tripCount; i++) {
            const row = sheet.getRow(currentRow);
            if (i === 0) { row.getCell('B').value = exp.date; row.getCell('C').value = end || exp.destination; }
            const section = i === 0 ? `${start} 〜 ${end}` : `${end} 〜 ${start}`;
            sheet.mergeCells(`E${currentRow}:H${currentRow}`); row.getCell('E').value = section;
            sheet.mergeCells(`I${currentRow}:K${currentRow}`); row.getCell('I').value = exp.distance;
            dayTotalDistance += exp.distance;
            ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].forEach(c => row.getCell(c).border = thinBorder);
            currentRow++;
          }
          dayTotalAmount += exp.amount;
        });
        const summaryRow = sheet.getRow(25);
        sheet.mergeCells('I25:K25');
        summaryRow.getCell('I').value = dayTotalDistance; summaryRow.getCell('L').value = dayTotalAmount;
        summaryRow.getCell('L').numFmt = '#,##0'; ['I', 'L'].forEach(c => summaryRow.getCell(c).border = thinBorder);
      });

      const summarySheet = workbook.addWorksheet('合計精算書');
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `交通費精算_${currentMonth.getFullYear()}年${currentMonth.getMonth()+1}月.xlsx`);
    } catch (err) { console.error(err); alert('Excel出力に失敗しました。'); }
  };

  const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl text-white">
            <Train size={24} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">交通費精算システム</h2>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
              <span>{user.email}</span>
              {isAdmin && <span className="flex items-center gap-0.5 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full"><Shield size={10} /> 管理者</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToExcel} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 transition active:scale-95 font-bold text-sm"><Download className="mr-2 h-4 w-4" /> Excel出力</button>
          <button onClick={handleLogout} className="flex items-center px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-red-50 hover:text-red-600 transition active:scale-95 font-bold text-sm"><LogOut className="mr-2 h-4 w-4" /> ログアウト</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="bg-white rounded-[2rem] shadow-xl shadow-indigo-100/50 p-8 border border-indigo-50 space-y-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center"><Plus className="mr-2 h-5 w-5 text-indigo-500" /> 新規入力</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">氏名</label>
                <input type="text" required value={personName} onChange={(e) => setPersonName(e.target.value)} className="w-full p-3 border-2 border-gray-100 rounded-xl focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">日付</label>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 border-2 border-gray-100 rounded-xl focus:border-indigo-500 outline-none" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 flex items-center"><Navigation className="mr-1 h-4 w-4 text-indigo-500" /> 出発地</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input type="text" placeholder="名称" value={origin} onChange={(e) => setOrigin(e.target.value)} className="p-3 border-2 border-gray-100 rounded-xl focus:border-indigo-500 outline-none" />
                <input ref={originInputRef} type="text" placeholder="住所" value={originAddress} onChange={(e) => setOriginAddress(e.target.value)} className="md:col-span-2 p-3 border-2 border-gray-100 rounded-xl focus:border-indigo-500 outline-none" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 flex items-center"><MapPin className="mr-1 h-4 w-4 text-red-500" /> 行先</label>
              <div className="relative">
                <input ref={destinationInputRef} type="text" required value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full p-3 border-2 border-gray-100 rounded-xl focus:border-indigo-500 outline-none pr-24" />
                <button type="button" onClick={handleCalcDistance} disabled={calculating} className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{calculating ? '...' : '計算'}</button>
              </div>
            </div>
            {route && <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-sm font-bold text-indigo-700 flex items-center gap-2"><MapPin size={16}/> {route} {distance}km</div>}
            <div className="flex items-center gap-6 bg-gray-50 p-4 rounded-xl">
              <label className="flex items-center cursor-pointer"><input type="checkbox" checked={isRoundTrip} onChange={(e) => setIsRoundTrip(e.target.checked)} className="h-5 w-5 text-indigo-600 rounded" /><span className="ml-2 font-bold text-gray-700">往復</span></label>
              <div className="flex-1 text-right"><span className="text-sm text-gray-500">推定金額:</span><span className="ml-2 text-2xl font-black text-indigo-700">¥{amount.toLocaleString()}</span></div>
            </div>
            <button type="submit" disabled={saving || amount <= 0} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">{saving ? <Loader2 className="animate-spin" /> : <Plus size={24} />} 保存する</button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-black text-gray-900 flex items-center gap-2"><History className="h-5 w-5 text-gray-400" /> {isAdmin ? '全職員の記録' : '自分の記録'}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="p-1 hover:bg-white rounded-lg transition"><ChevronLeft size={16} /></button>
                <span className="text-sm font-bold">{currentMonth.getFullYear()}年{currentMonth.getMonth()+1}月</span>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="p-1 hover:bg-white rounded-lg transition"><ChevronRight size={16} /></button>
              </div>
            </div>
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {loading ? <div className="p-12 text-center text-gray-400 font-bold italic">読み込み中...</div> : 
               expenses.length === 0 ? <div className="p-12 text-center text-gray-400 font-bold italic">記録がありません</div> :
               expenses.map(exp => (
                <div key={exp.id} className="p-4 hover:bg-indigo-50/30 transition group">
                  <div className="flex justify-between items-start mb-1"><span className="text-[10px] font-bold text-gray-400">{exp.date}</span><button onClick={() => deleteExpense(exp.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={14} /></button></div>
                  <p className="font-bold text-gray-900 leading-tight mb-1 text-sm">{exp.destination}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className="text-[10px] font-black px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded uppercase">{exp.is_round_trip ? '往復' : '片道'}</span><span className="text-[10px] font-bold text-gray-400 italic">{exp.person_name}</span></div>
                    <span className="font-black text-indigo-600 text-lg">¥{exp.amount.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100">
            <p className="text-xs font-bold opacity-80 uppercase tracking-widest flex items-center gap-2"><Calendar size={14} /> 月間合計額</p>
            <p className="text-4xl font-black mt-1 tracking-tight">¥{totalAmount.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
