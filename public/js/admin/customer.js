 function handleSearch(){
  const searchValue=document.getElementById("brand-search-input").value;
  const url=new URL(window.location);

  if(searchValue){
    url.searchParams.set("search",searchValue);
  }else{
    url.searchParams.delete('search');
  }
  url.searchParams.set("page",1);
  window.location.href=url.href;
 }
function clearSearch() {
  const url = new URL(window.location);
  url.searchParams.delete("search");
  url.searchParams.set("page", 1);
  window.location.href = url.href;
}

document.querySelectorAll(".block-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const userId = btn.dataset-userId;
    try {
      const res = await axios.patch(`/admin/customers/toggle-block/${userId}`);

      if(!res.data.success){
         Toastify({
          text: "Something went wrong!",
          duration: 3000,
          gravity: "top",
          position: "right",
          backgroundColor: "#e74c3c"
        }).showToast();
        return;
      }
      const isBlocked=res.data.isBlocked;

      document.getElementById(`status-${userId}`).innerText=isBlocked?"Blocked":"Active";
      btn.innerText=isBlocked?"Unblock":"Block";
        Toastify({
        text: isBlocked ? "User blocked" : "User unblocked",
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: isBlocked ? "#c0392b" : "#27ae60"
      }).showToast();
    }catch(error){
      Toastify({
        text: "Server error",
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: "#e74c3c"
      }).showToast();
      console.error(err);
    }
  });
});