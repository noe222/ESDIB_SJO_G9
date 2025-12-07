    //CONFIG
    const API_BASE = 'http://127.0.0.1:4000/api'; //Backend de forma local
    //const API_BASE = 'https://esdibdemo.azurewebsites.net/api'; //Backend para azure

    const API_KEY  = '0b6ff7a64ff939ef91b31f4361bfa010301ca847c3aa7eff54eb78ac1c52b8c1'; //API KEY del backend

    // Estado
    let editingId = null; //Para el sistema de edicion

    //Funciones helpers
    const q = (id) => document.getElementById(id);
    const val = (id) => (q(id)?.value ?? '').trim();
    const toIntOrNull = s => (s && s.trim() !== '' ? parseInt(s, 10) : null);
    function toNullIfEmpty(s){ if(s==null) return null; const t = String(s).trim(); return t===''?null:t; }
    //Funcion para adaptar el _id de mongo a string
    function normId(p){
      if(!p || !p._id) return null;
      if(typeof p._id === 'string') return p._id;
      if(typeof p._id === 'object' && p._id.$oid) return p._id.$oid;
      try { return String(p._id); } catch { return null; }
    }

    //Función para errores y cabeceras
    async function apiFetch(path, options = {}) {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, ...(options.headers||{}) }
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => 'Error');
        throw new Error(msg || 'Error de red');
      }
      return res.status !== 204 ? res.json() : null;
    }

    //Funcion para añadir todas las imagenes de azure en el front
    async function renderPhotosForPet(pet, photosWrap) {
      photosWrap.innerHTML = ''; // limpia

      // 1) Si ya vienen URLs en el documento (p.ej. backend añade SAS)
      const hasInlineUrls = Array.isArray(pet.photos) && pet.photos.some(ph => ph && ph.url);
      if (hasInlineUrls) {
        pet.photos.forEach(ph => {
          if (!ph?.url) return;
          const img = document.createElement('img');
          img.src = ph.url;
          img.alt = pet.nombre || 'foto';
          photosWrap.appendChild(img);
        });
        if (photosWrap.children.length === 0) {
          photosWrap.innerHTML = '<span class="muted">(sin fotos)</span>';
        }
        return;
      }

      // 2) Si no vienen URLs pero sí blobNames, intenta pedir al backend /photos (con SAS)
      const id = normId(pet);
      if (id) {
        try {
          const arr = await apiFetch(`/pets/${id}/photos`, { method: 'GET' });
          if (Array.isArray(arr) && arr.length > 0) {
            arr.forEach(ph => {
              if (!ph?.url) return;
              const img = document.createElement('img');
              img.src = ph.url;
              img.alt = pet.nombre || 'foto';
              photosWrap.appendChild(img);
            });
            if (photosWrap.children.length > 0) return;
          }
        } catch (e) {
          console.warn('No se pudieron obtener URLs SAS para', id, e);
        }
      }

      // 3) Fallback si no hay nada que mostrar
      photosWrap.innerHTML = '<span class="muted">(sin fotos)</span>';
    }

    //Función para obtener todo el contenido de la BBDD y crear un listado
    async function cargarLista() {
      try {
        const data = await apiFetch('/pets', { method: 'GET' });
        const pets = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
        const list = q('pets-list');
        if (!list) return;
        list.innerHTML = '';

        for (const p of pets) {
          const li = document.createElement('li');
          li.className = 'pet-item';

          const header = document.createElement('div');
          header.className = 'pet-header';
          const nombre = p?.nombre || '(sin nombre)';
          const animal = p?.animal || '(sin animal)';
          const raza   = p?.raza || '';
          header.textContent = `${nombre} (${animal})${raza ? ' – ' + raza : ''}`;

          // Acciones
          const actions = document.createElement('div');
          actions.className = 'pet-actions';
          const edit = document.createElement('button');
          edit.textContent = 'Editar';
          edit.onclick = () => startEdit(p);

          const del = document.createElement('button');
          del.textContent = 'Eliminar';
          del.onclick = async () => {
            const id = normId(p);
            if (!id) return alert('ID no válido');
            if (!confirm('¿Eliminar este registro?')) return;
            try {
              await apiFetch(`/pets/${id}`, { method: 'DELETE' });
              await cargarLista();
              if (editingId === id) resetForm();
            } catch (e) {
              alert('Error al eliminar: ' + e.message);
            }
          };

          actions.appendChild(edit);
          actions.appendChild(del);

          const photosWrap = document.createElement('div');
          photosWrap.className = 'pet-photos';
          await renderPhotosForPet(p, photosWrap);

          li.appendChild(header);
          li.appendChild(actions);
          li.appendChild(photosWrap);
          list.appendChild(li);
        }
      } catch (e) {
        console.error(e);
        alert('Error al cargar la lista');
      }
    }

    // Construir el payload JSON para UPDATE (sin fotos)
    function buildJsonPayloadFromForm() {
      return {
        animal: val('animal'),
        nombre: val('nombre'),
        raza: val('raza'),
        collar: toIntOrNull(val('collar')),
        edad: toIntOrNull(val('edad')),
        pelo: q('pelo').value || null,
        "tamaño": q('tamaño').value || null,
        color: q('color').value || null,
        sexo: q('sexo').value || null,
        fecha: val('fecha') || null,
        descripcion: val('descripcion') || null
      };
    }


    //Función que envia los datos del formulario y las fotos al backend
    async function onSubmitForm(ev) {
      ev.preventDefault();
      const btn = q('upload-button'); 
      btn.disabled = true;

      try {
        if (!val('animal') || !val('nombre')) {
          alert('Los campos "Animal" y "Nombre" son obligatorios');
          return;
        }

        // MODO EDICIÓN: hacemos PUT /pets/:id con JSON (sin fotos)
        if (editingId) {
          const payload = buildJsonPayloadFromForm();
          await apiFetch(`/pets/${editingId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          });
          alert('Registro actualizado');
          await cargarLista();
          resetForm();
          return;
        }

        // MODO CREACIÓN: hacemos POST /pets con FormData (datos + fotos)
        const fd = new FormData();
        fd.append('animal', val('animal'));
        fd.append('nombre', val('nombre'));
        fd.append('raza', val('raza'));
        fd.append('collar', val('collar'));
        fd.append('edad', val('edad'));
        fd.append('pelo', q('pelo').value);
        fd.append('tamaño', q('tamaño').value);
        fd.append('color', q('color').value);
        fd.append('sexo', q('sexo').value);
        fd.append('fecha', q('fecha').value);
        fd.append('descripcion', val('descripcion'));

        const fileInput = q('files');
        if (fileInput.files && fileInput.files.length > 0) {
          for (const f of fileInput.files) {
            fd.append('files', f, f.name);
          }
        }

        const res = await fetch(`${API_BASE}/pets`, {
          method: 'POST',
          headers: { 'x-api-key': API_KEY },
          body: fd
        });

        if (!res.ok) throw new Error(await res.text());
        alert('Registro creado');
        await cargarLista();
        resetForm();
      } catch (e) {
        console.error(e);
        alert('Error al guardar: ' + e.message);
      } finally {
        btn.disabled = false;
      }
    }


    //Función para resetear el formulario
    function resetForm() {
      q('alta_pet')?.reset();
      editingId = null;
      const label = document.querySelector('#upload-button label');
      if (label) label.textContent = 'GUARDAR';
      q('cancel-edit').style.display = 'none';
      const title = document.querySelector('.title');
      if (title) title.textContent = 'UPLOAD PET';
    }

    // Esto es para rellenar todo el formulario con los datos del registro a editar
    function startEdit(p) {
      const id = normId(p);
      if (!id) return alert('ID no válido');
      editingId = id;

      q('animal').value = p.animal || '';
      q('nombre').value = p.nombre || '';
      q('raza').value   = p.raza || '';
      q('collar').value = (p.collar ?? '') + '';
      q('edad').value   = (p.edad ?? '') + '';
      q('pelo').value   = p.pelo || '';
      q('tamaño').value = p['tamaño'] || '';
      q('color').value  = p.color || '';
      q('sexo').value   = p.sexo || '';
      if (p.fecha) {
        const d = new Date(p.fecha);
        q('fecha').value = isNaN(d.getTime()) ? '' :
          `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      } else {
        q('fecha').value = '';
      }
      q('descripcion').value = p.descripcion || '';

      const label = document.querySelector('#upload-button label');
      if (label) label.textContent = 'ACTUALIZAR';
      q('cancel-edit').style.display = 'inline-block';
      const title = document.querySelector('.title');
      if (title) title.textContent = 'EDIT PET';

      q('animal').focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    //Arranqueee!!!
    document.addEventListener('DOMContentLoaded', () => {
      cargarLista();
      q('alta_pet')?.addEventListener('submit', onSubmitForm);
      q('cancel-edit')?.addEventListener('click', resetForm);
    });