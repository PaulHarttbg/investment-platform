document.addEventListener('DOMContentLoaded', () => {
    const packages = {
        starter: {
            name: 'Starter Package',
            return: '8%',
            duration: '3 months',
            min: 100,
            max: 5000,
            annualRate: 0.08
        },
        professional: {
            name: 'Professional Package',
            return: '10%',
            duration: '6 months',
            min: 1000,
            max: 25000,
            annualRate: 0.10
        },
        premium: {
            name: 'Premium Package',
            return: '12%',
            duration: '12 months',
            min: 5000,
            max: 100000,
            annualRate: 0.12
        }
    };

    let selectedPackageData = null;

    const investmentModal = document.getElementById('investmentModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelInvestmentBtn = document.getElementById('cancelInvestmentBtn');
    const confirmInvestmentBtn = document.getElementById('confirmInvestmentBtn');
    const packageBtns = document.querySelectorAll('.package-btn');
    const modalInvestmentAmountInput = document.getElementById('modalInvestmentAmount');

    function openInvestmentModal(packageName) {
        selectedPackageData = packages[packageName];

        document.getElementById('modalPackageName').textContent = selectedPackageData.name;
        document.getElementById('modalReturn').textContent = selectedPackageData.return;
        document.getElementById('modalDuration').textContent = selectedPackageData.duration;
        document.getElementById('modalMinAmount').textContent = selectedPackageData.min;
        document.getElementById('modalMaxAmount').textContent = selectedPackageData.max;
        
        modalInvestmentAmountInput.value = '';
        modalInvestmentAmountInput.min = selectedPackageData.min;
        modalInvestmentAmountInput.max = selectedPackageData.max;

        updateModalProjection();

        if (investmentModal) {
            investmentModal.style.display = 'block';
        }
    }

    function closeInvestmentModal() {
        if (investmentModal) {
            investmentModal.style.display = 'none';
        }
    }

    function updateModalProjection() {
        if (!selectedPackageData || !modalInvestmentAmountInput) return;

        const amount = parseFloat(modalInvestmentAmountInput.value) || 0;
        const monthlyRate = selectedPackageData.annualRate / 12;
        const durationMonths = parseInt(selectedPackageData.duration);

        const monthlyReturn = amount * monthlyRate;
        const totalProfit = monthlyReturn * durationMonths;
        const finalAmount = amount + totalProfit;

        document.getElementById('modalMonthlyReturn').textContent = `$${monthlyReturn.toFixed(2)}`;
        document.getElementById('modalTotalProfit').textContent = `$${totalProfit.toFixed(2)}`;
        document.getElementById('modalFinalAmount').textContent = `$${finalAmount.toFixed(2)}`;
    }

    function confirmInvestment() {
        if (!selectedPackageData || !modalInvestmentAmountInput) return;

        const amount = parseFloat(modalInvestmentAmountInput.value);
        const agreeTerms = document.getElementById('agreeTerms').checked;

        if (isNaN(amount) || amount < selectedPackageData.min || amount > selectedPackageData.max) {
            alert(`Please enter an amount between $${selectedPackageData.min} and $${selectedPackageData.max}.`);
            return;
        }

        if (!agreeTerms) {
            alert('You must agree to the Terms and Conditions.');
            return;
        }

        console.log('Investment Confirmed:', {
            package: selectedPackageData.name,
            amount: amount
        });

        alert('Investment confirmed successfully!');
        closeInvestmentModal();
    }

    // Event Listeners for Modal
    packageBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const packageName = btn.closest('.package-card').dataset.package;
            openInvestmentModal(packageName);
        });
    });

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeInvestmentModal);
    }

    if (cancelInvestmentBtn) {
        cancelInvestmentBtn.addEventListener('click', closeInvestmentModal);
    }

    if (confirmInvestmentBtn) {
        confirmInvestmentBtn.addEventListener('click', confirmInvestment);
    }

    if (modalInvestmentAmountInput) {
        modalInvestmentAmountInput.addEventListener('input', updateModalProjection);
    }

    window.addEventListener('click', (event) => {
        if (event.target === investmentModal) {
            closeInvestmentModal();
        }
    });

    // Investment Calculator Logic
    const investmentAmountInput = document.getElementById('investmentAmount');
    const selectedPackageInput = document.getElementById('selectedPackage');
    const monthlyReturnEl = document.getElementById('monthlyReturn');
    const totalReturnEl = document.getElementById('totalReturn');
    const finalAmountEl = document.getElementById('finalAmount');

    function calculateProjection() {
        const amount = parseFloat(investmentAmountInput.value) || 0;
        const selectedPackage = selectedPackageInput.value;
        const packageData = packages[selectedPackage];

        if (!packageData) return;

        const monthlyRate = packageData.annualRate / 12;
        const durationMonths = parseInt(packageData.duration);

        const monthlyReturn = amount * monthlyRate;
        const totalProfit = monthlyReturn * durationMonths;
        const finalAmount = amount + totalProfit;

        if (monthlyReturnEl) monthlyReturnEl.textContent = `$${monthlyReturn.toFixed(2)}`;
        if (totalReturnEl) totalReturnEl.textContent = `$${totalProfit.toFixed(2)}`;
        if (finalAmountEl) finalAmountEl.textContent = `$${finalAmount.toFixed(2)}`;
    }

    if (investmentAmountInput && selectedPackageInput) {
        investmentAmountInput.addEventListener('input', calculateProjection);
        selectedPackageInput.addEventListener('change', calculateProjection);
        calculateProjection(); // Initial calculation
    }
});
