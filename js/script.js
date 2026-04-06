let user = "";
let station = "";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbya3UMc35FN6vAUUSTnQZblrM7-acppK8brZeuK_ClaZpFfamZoVoKKhYmvFQ4Ug-I0/exec"; 

function login() {
    const idInput = document.getElementById('employee-id');
    const stInput = document.getElementById('station-id');
    
    const empId = idInput.value.trim();
    const staId = stInput.value.trim();

    // --- REGLAS DE VALIDACIÓN ---
    
    // 1. Estructura '0xxxxxA': Empieza con 0, sigue con 5 números y termina con A
    // Si la cantidad de números entre el 0 y la A varía, cambia el {5} por +
    const userRegex = /^0\d{5}A/i; 
    
    // 2. Estación: Inicia con WOD (mayúscula o minúscula)
    const stationRegex = /^WOD/i; 

    // Validación del Usuario
    if (!userRegex.test(empId)) {
        alert("ID de empleado inválido. Debe iniciar con '0', tener 5 dígitos y terminar con 'A' (Ej: 012345A)");
        idInput.focus();
        return;
    }

    // Validación de la Estación
    if (!stationRegex.test(staId)) {
        alert("ID de estación inválido. Debe iniciar con 'WOD' (Ej: WOD-01)");
        stInput.focus();
        return;
    }

    // Si pasa ambas validaciones, procedemos al login
    user = empId;
    station = staId.toUpperCase(); // Guardamos estación en mayúsculas por estandarización
    
    document.getElementById('user-display').innerText = `Op: ${user.slice(1,6)}`;
    document.getElementById('station-display').innerText = station;
    
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    // Cargar pendientes del empleado
    loadPendingRepairs();
}

// NUEVA FUNCIÓN PARA TRAER DATOS DEL EXCEL
async function loadPendingRepairs() {
    const tableBody = document.getElementById('rejection-body');
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center">Buscando sus pendientes...</td></tr>';
    
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            // ENVIAMOS EL ID DEL USUARIO ACTUAL
            body: JSON.stringify({ 
                actionType: "GET_PENDING", 
                data: { op: user } 
            })
        });
        const data = await response.json();
        
        tableBody.innerHTML = ''; 
        
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#86868b">No tiene reparaciones pendientes</td></tr>';
        } else {
            data.forEach(item => addTableRow(item));
        }
    } catch (e) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red">Error al cargar sus datos</td></tr>';
    }
}

async function registerPiece() {
    const barcodeInput = document.getElementById('barcode-input');
    const barcode = barcodeInput.value.trim();
    const statusRadio = document.querySelector('input[name="status"]:checked');
    const status = statusRadio.value;
    const failure = document.getElementById('failure-type').value;
    const btn = document.getElementById('btn-register');

    if (!barcode) return;

    setLoading(btn, true, "Registrando...");

    let modelName = "N/A";
    try {
        const apiRes = await fetch(`http://rosarbciis04:8012/api/Quality?shopfloorid=${barcode}`);
        const apiData = await apiRes.json();
        if(apiData.data && apiData.data.length > 0) modelName = apiData.data[0].shop_floor_model;
    } catch (e) { console.warn("API Local no disponible"); }

    const payload = {
        actionType: "CREATE",
        data: {
            barcode: barcode,
            model: modelName,
            status: status,
            failure: status === "FAIL" ? failure : "N/A",
            op: user,
            st: station
        }
    };

    try {
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
        
        // Si fue falla, agregamos a la tabla visualmente
        if (status === "FAIL") addTableRow(payload.data);

        // --- REINICIAR FORMULARIO (Punto 1 de tu solicitud) ---
        barcodeInput.value = "";
        document.getElementById('status-ok').checked = true; // Forzamos radio a OK
        toggleFailureSelect(false); // Escondemos el menú de fallas
        barcodeInput.focus();

    } catch (e) {
        alert("Error al guardar.");
    } finally {
        setLoading(btn, false, "Registrar Movimiento");
    }
}

// El resto de funciones (closeRepair, addTableRow, etc.) se mantienen igual
// Solo asegúrate de que el radio de "OK" tenga el id="status-ok" en tu HTML

async function closeRepair(btnElement, barcode) {
    const actionSelect = document.getElementById(`repair-act-${barcode}`);
    const action = actionSelect.value;

    // Cambiar estado visual del botón inmediatamente
    setLoading(btnElement, true, "");

    const payload = {
        actionType: "REPAIR",
        data: {
            barcode: barcode,
            action: action,
            op: user
        }
    };

    try {
        // Usar fetch con el payload corregido
        await fetch(SCRIPT_URL, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify(payload) 
        });

        // Eliminar fila tras respuesta exitosa
        const row = document.getElementById(`row-${barcode}`);
        row.style.opacity = "0.3";
        setTimeout(() => row.remove(), 300);

    } catch (error) {
        alert("No se pudo guardar la reparación. Reintente.");
        setLoading(btnElement, false, "Finalizar");
    }
}

function addTableRow(item) {
    const body = document.getElementById('rejection-body');
    const row = document.createElement('tr');
    row.id = `row-${item.barcode}`;
    row.innerHTML = `
        <td><b>${item.barcode}</b></td>
        <td style="color:var(--apple-red); font-weight:600;">${item.failure}</td>
        <td>
            <select id="repair-act-${item.barcode}" class="repair-select">
                <option value="Re-ensamble cover">Re-ensamble cover</option>
                <option value="Re-ensamble spool">Re-ensamble spool</option>
                <option value="Re-ensamble general">Re-ensamble general</option>
                <option value="Cambio Kit Transmisión + Motor">Cambio Kit Transmisión + Motor</option>
            </select>
        </td>
        <td>
            <button class="btn btn-success" onclick="closeRepair(this, '${item.barcode}')">Finalizar</button>
        </td>
    `;
    body.prepend(row);
}

function setLoading(btn, isLoading, text) {
    if (isLoading) {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> ${text}`;
    } else {
        btn.disabled = false;
        btn.innerHTML = text || "Finalizar";
    }
}

function toggleFailureSelect(show) {
    document.getElementById('failure-container').classList.toggle('hidden', !show);
}

function logout() { location.reload(); }

function filterTable() {
    // 1. Obtener el valor del buscador
    const input = document.getElementById('table-search');
    const filter = input.value.toLowerCase().trim();
    
    // 2. Obtener todas las filas del cuerpo de la tabla
    const tbody = document.getElementById('rejection-body');
    const rows = tbody.getElementsByTagName('tr');

    // 3. Recorrer cada fila y ocultar las que no coincidan
    for (let i = 0; i < rows.length; i++) {
        // Buscamos el texto solo en la primera celda (columna del código de barras)
        const barcodeCell = rows[i].getElementsByTagName('td')[0];
        
        if (barcodeCell) {
            const textValue = barcodeCell.textContent || barcodeCell.innerText;
            
            // Si el filtro está vacío o si el código contiene el texto buscado
            if (textValue.toLowerCase().indexOf(filter) > -1) {
                rows[i].style.display = ""; // Mostrar
            } else {
                rows[i].style.display = "none"; // Ocultar
            }
        }
    }
}