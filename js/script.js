let user = "";
let station = "";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx1SNFWKpOYNhV9oTEjvuf82penWY_rAfMi5CMHkHR518u8xwLuVyfyz_93CKqz_ev3/exec"; 

function login() {
    const idInput = document.getElementById('employee-id');
    const stInput = document.getElementById('station-id');
    const empId = idInput.value.trim();
    const staId = stInput.value.trim();

    const userRegex = /^0\d{5}A/i; 
    const stationRegex = /^WOD/i; 

    if (!userRegex.test(empId)) {
        alert("ID de empleado inválido (Ej: 012345A)");
        return;
    }
    if (!stationRegex.test(staId)) {
        alert("ID de estación inválido (Ej: WOD-01 o WOD_ALL_REP)");
        return;
    }

    user = empId;
    station = staId.toUpperCase();
    
    // Ocultar pantalla de login
    document.getElementById('login-screen').classList.add('hidden');

    // RUTEO DEPENDIENDO DE LA ESTACIÓN
    if (station === 'WOD_ALL_REP') {
        // MODO ADMINISTRADOR
        document.getElementById('admin-user-display').innerText = `Admin: ${user.slice(1,6)}`;
        document.getElementById('dashboard-app').classList.remove('hidden');
        loadAllRecords();
    } else {
        // MODO OPERADOR NORMAL
        document.getElementById('user-display').innerText = `Op: ${user.slice(1,6)}`;
        document.getElementById('station-display').innerText = station;
        document.getElementById('main-app').classList.remove('hidden');
        loadPendingRepairs();
    }
}

async function loadPendingRepairs() {
    const tableBody = document.getElementById('rejection-body');
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center">Buscando pendientes...</td></tr>';
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ actionType: "GET_PENDING", data: { op: user } })
        });
        const data = await response.json();
        tableBody.innerHTML = ''; 
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#86868b">Sin reparaciones pendientes</td></tr>';
        } else {
            data.forEach(item => addTableRow(item));
        }
    } catch (e) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red">Error de conexión</td></tr>';
    }
}

function toggleInputsFalla() {
    const seleccion = document.getElementById('tipoFalla').value;
    const panelInicio = document.getElementById('panelFallaInicio');
    const panelOperacion = document.getElementById('panelFallaOperacion');

    panelInicio.classList.add('hidden');
    panelOperacion.classList.add('hidden');

    document.querySelectorAll('input[name="sub_falla_radio"]').forEach(radio => radio.checked = false);
    
    // Limpiar todos los checkboxes al cambiar de opción
    document.querySelectorAll('#failure-container input[type="checkbox"]').forEach(cb => cb.checked = false);

    if (seleccion === '1') panelInicio.classList.remove('hidden');
    else if (seleccion === '2') panelOperacion.classList.remove('hidden');
}

async function registerPiece() {
    const barcodeInput = document.getElementById('barcode-input');
    const barcode = barcodeInput.value.trim();
    const status = document.querySelector('input[name="status"]:checked').value;
    const btn = document.getElementById('btn-register');

    if (!barcode) return;

    // --- Lógica para construir el string de falla ---
    // --- Lógica para construir el string de falla ---
    // --- Lógica para recolectar la falla (Selección Única) ---
    let failureDetails = "N/A";
    if (status === "FAIL") {
        const tipoCabecera = document.getElementById('tipoFalla').value;
        const subFallaSeleccionada = document.querySelector('input[name="sub_falla_radio"]:checked');
        
        if (subFallaSeleccionada) {
            // Combinamos el número de categoría con el texto exacto de la opción
            failureDetails = `${tipoCabecera === '1' ? '1. Inicio' : '2. Operación'}: ${subFallaSeleccionada.value}`;
        } else {
            failureDetails = "Falla sin detalle seleccionado";
        }
    }

    setLoading(btn, true, "Registrando...");

    let modelName = "N/A";

    // API Call feature disable ***CORS ERROR***
    /*try {
        const apiRes = await fetch(`http://rosarbciis04:8012/api/Quality?shopfloorid=${barcode}`);
        const apiData = await apiRes.json();
        if(apiData.data && apiData.data.length > 0) modelName = apiData.data[0].shop_floor_model;
    } catch (e) { console.warn("API Local offline"); }*/

    const payload = {
        actionType: "CREATE",
        data: { barcode, model: modelName, status, failure: failureDetails, op: user, st: station }
    };

    try {
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
        if (status === "FAIL") addTableRow(payload.data);

        // Resetear formulario
        barcodeInput.value = "";
        document.getElementById('status-ok').checked = true;
        toggleFailureSelect(false);
        document.getElementById('tipoFalla').value = "";
        document.getElementById('panelFallaInicio').classList.add('hidden');
        document.getElementById('panelFallaOperacion').classList.add('hidden');
        barcodeInput.focus();
    } catch (e) { alert("Error al guardar"); }
    finally { setLoading(btn, false, "Registrar Movimiento"); }
}

function addTableRow(item) {
    const body = document.getElementById('rejection-body');
    const row = document.createElement('tr');
    row.id = `row-${item.barcode}`;
    row.innerHTML = `
        <td><b>${item.barcode}</b></td>
        <td style="color:var(--apple-red); font-weight:600; font-size:13px;">${item.failure}</td>
        <td>
            <select id="repair-act-${item.barcode}" class="repair-select">
                <option value="Re-ensamble cover">Re-ensamble cover</option>
                <option value="Re-ensamble spool">Re-ensamble spool</option>
                <option value="Re-ensamble general">Re-ensamble general</option>
                <option value="Cambio Kit Transmisión + Motor">Cambio Kit Transmisión + Motor</option>
            </select>
        </td>
        <td><button class="btn btn-success" onclick="closeRepair(this, '${item.barcode}')">Finalizar</button></td>
    `;
    body.prepend(row);
}

async function closeRepair(btn, barcode) {
    const action = document.getElementById(`repair-act-${barcode}`).value;
    setLoading(btn, true, "");
    const payload = { actionType: "REPAIR", data: { barcode, action, op: user } };
    try {
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
        const row = document.getElementById(`row-${barcode}`);
        row.style.opacity = "0.3";
        setTimeout(() => row.remove(), 300);
    } catch (e) { 
        alert("Error"); 
        setLoading(btn, false, "Finalizar");
    }
}

// Función para el panel de Administrador
async function loadAllRecords() {
    const tableBody = document.getElementById('dashboard-body');
    tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center">Descargando base de datos...</td></tr>';
    
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ actionType: "GET_ALL" })
        });
        const data = await response.json();
        
        tableBody.innerHTML = ''; 
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#86868b">No hay registros almacenados</td></tr>';
        } else {
            data.reverse().forEach(item => {
                const row = document.createElement('tr');
                
                let inspBadge = item.status === "OK" ? `<span class="badge badge-ok">OK</span>` : `<span class="badge badge-fail">FALLA</span>`;
                
                let finalStatus = "";
                if (item.status === "OK") {
                    finalStatus = `<span class="badge badge-ok">Liberado</span>`;
                } else if (item.action && item.action !== "N/A" && item.action !== "") {
                    finalStatus = `<span class="badge badge-repaired">Reparado</span>`;
                } else {
                    finalStatus = `<span class="badge badge-pending">Pendiente</span>`;
                }

                // Determinamos la fecha del último movimiento registrado
                const fechaUltimo = item.repairTime || item.regTime;

                row.innerHTML = `
                    <td><b>${item.barcode}</b></td>
                    <td style="font-size:12px;">${item.model || "N/A"}</td>
                    <td>${inspBadge}</td>
                    <td style="font-size:12px;">${item.failure !== "N/A" ? item.failure : "-"}</td>
                    <td style="font-size:12px; font-weight:600;">${item.action || "-"}</td>
                    <td style="font-size:12px;">${item.st || "-"}</td>
                    <td>${item.op}</td>
                    <td>${finalStatus}</td>
                    <td style="font-size:11px; color:var(--text-sub); white-space: nowrap;">${fechaUltimo}</td>
                `;
                tableBody.appendChild(row);
            });
        }
    } catch (e) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:red">Error de conexión</td></tr>';
    }
}

// Buscador en tiempo real para el panel de Administrador
function filterDashboardTable() {
    const filter = document.getElementById('dashboard-search').value.toLowerCase();
    const rows = document.getElementById('dashboard-body').getElementsByTagName('tr');
    
    for (let row of rows) {
        // Busca en todo el texto de la fila (código, modelo, falla, operador)
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(filter) ? "" : "none";
    }
}

function toggleFailureSelect(show) { document.getElementById('failure-container').classList.toggle('hidden', !show); }
function setLoading(btn, loading, text) { btn.disabled = loading; btn.innerHTML = loading ? `<span class="spinner"></span>` : text; }
function logout() { location.reload(); }
function filterTable() {
    const filter = document.getElementById('table-search').value.toLowerCase();
    const rows = document.getElementById('rejection-body').getElementsByTagName('tr');
    for (let row of rows) {
        const text = row.cells[0].textContent.toLowerCase();
        row.style.display = text.includes(filter) ? "" : "none";
    }
}
