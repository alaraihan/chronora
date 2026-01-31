import Order from "../../models/orderSchema.js";
import PDFDocument from "pdfkit";
export const getSalesReportPage = async (req, res) => {
  try {
    res.render("admin/salesReport", {
      title: "Sales Report",
      page:"Sales"
    });
  } catch (error) {
    console.error("Sales report page error:", error);
    res.status(500).send("Server Error");
  }
};

export const getSalesReportData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;

    const { search, dateFrom, dateTo } = req.query;
    const matchConditions = {};

    if (dateFrom || dateTo) {
      matchConditions.createdAt = {};
      if (dateFrom) {
        matchConditions.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        matchConditions.createdAt.$lte = endDate;
      }
    }

    if (search) {
      matchConditions.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { "address.fullName": { $regex: search, $options: "i" } },
        { "userId.email": { $regex: search, $options: "i" } }
      ];
    }

    const pipeline = [
      { $match: matchConditions },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userId"
        }
      },
      { $unwind: { path: "$userId", preserveNullAndEmptyArrays: true } },
      { $unwind: "$products" },
      {
        $match: {
          "products.itemStatus": "Delivered"
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "products.productId",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          orderDate: "$createdAt",
          orderId: 1,
          customer: {
            email: "$userId.email",
            fullName: "$address.fullName"
          },
          productName: "$productInfo.name",
          variantInfo: {
            $concat: [
              { $ifNull: ["$products.variantId.colorName", ""] },
              { $cond: [{ $ne: ["$products.variantId.size", ""] }, " · ", ""] },
              { $ifNull: ["$products.variantId.size", ""] }
            ]
          },
          quantity: "$products.quantity",
          price: "$products.price",
          lineTotal: {
            $multiply: ["$products.quantity", "$products.price"]
          },
          paymentMethod: 1,
          discount: { $ifNull: ["$discount", 0] },
          couponDiscount: { $ifNull: ["$couponDiscount", 0] }
        }
      },
      { $sort: { orderDate: -1 } }
    ];

    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await Order.aggregate(countPipeline);
    const totalOrders = countResult.length > 0 ? countResult[0].total : 0;

    const lineItems = await Order.aggregate([
      ...pipeline,
      { $skip: skip },
      { $limit: limit }
    ]);

    const summaryPipeline = [
      { $match: matchConditions },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userId"
        }
      },
      { $unwind: { path: "$userId", preserveNullAndEmptyArrays: true } },
      { $unwind: "$products" },
      {
        $match: {
          "products.itemStatus": "Delivered"
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: {
            $sum: { $multiply: ["$products.quantity", "$products.price"] }
          },
          totalItemsSold: { $sum: "$products.quantity" },
          totalDiscount: {
            $sum: {
              $add: [
                { $ifNull: ["$discount", 0] },
                { $ifNull: ["$couponDiscount", 0] }
              ]
            }
          }
        }
      }
    ];

    const summaryResult = await Order.aggregate(summaryPipeline);
    const summary = summaryResult.length > 0 ? summaryResult[0] : {
      totalOrders: 0,
      totalRevenue: 0,
      totalDiscount: 0,
      totalItemsSold: 0
    };

    res.json({
      success: true,
      summary: {
        totalOrders: summary.totalOrders,
        totalRevenue: summary.totalRevenue,
        totalDiscount: summary.totalDiscount,
        totalItemsSold: summary.totalItemsSold
      },
      lineItems,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders
      }
    });

  } catch (error) {
    console.error("Sales report data error:", error);
    res.status(500).json({
      success: false,
      message: "Error loading sales data"
    });
  }
};
export const downloadSalesReport = async (req, res) => {
  try {
    const { search, dateFrom, dateTo, format = "csv" } = req.query;

    const matchConditions = {};

    if (dateFrom || dateTo) {
      matchConditions.createdAt = {};
      if (dateFrom) {
        matchConditions.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        matchConditions.createdAt.$lte = endDate;
      }
    }

    if (search) {
      matchConditions.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { "address.fullName": { $regex: search, $options: "i" } },
        { "userId.email": { $regex: search, $options: "i" } }
      ];
    }

    const pipeline = [
      { $match: matchConditions },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userId"
        }
      },
      { $unwind: { path: "$userId", preserveNullAndEmptyArrays: true } },
      { $unwind: "$products" },
      {
        $match: {
          "products.itemStatus": "Delivered"
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "products.productId",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          orderDate: "$createdAt",
          orderId: 1,
          customerEmail: "$userId.email",
          customerName: "$address.fullName",
          productName: "$productInfo.name",
          variant: {
            $concat: [
              { $ifNull: ["$products.variantId.colorName", ""] },
              { $cond: [{ $ne: ["$products.variantId.size", ""] }, " · ", ""] },
              { $ifNull: ["$products.variantId.size", ""] }
            ]
          },
          quantity: "$products.quantity",
          price: "$products.price",
          lineTotal: {
            $multiply: ["$products.quantity", "$products.price"]
          },
          paymentMethod: 1
        }
      },
      { $sort: { orderDate: -1 } }
    ];

    const lineItems = await Order.aggregate(pipeline);

    if (format === "pdf") {
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: 35
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="sales-report-${new Date().toISOString().split("T")[0]}.pdf"`
      );

      doc.pipe(res);

      doc
        .fontSize(18)
        .font("Helvetica-Bold")
        .text("Sales Report - Delivered Items Only", { align: "center" });

      doc.moveDown(0.7);
      doc
        .fontSize(11)
        .font("Helvetica")
        .text(`Generated: ${new Date().toLocaleString("en-IN")}`, { align: "center" });

      doc.moveDown(2);

      if (lineItems.length === 0) {
        doc
          .fontSize(12)
          .text("No delivered items found for the selected period/filters.", 50, doc.y);
      } else {
        const tableTop = doc.y;
        const rowHeight = 18;
        const colWidths = [58, 78, 105, 115, 85, 32, 68, 78, 75];
        const headers = [
          "Date", "Order ID", "Customer", "Product", "Variant",
          "Qty", "Unit Price", "Line Total", "Payment"
        ];

        doc.font("Helvetica-Bold").fontSize(10);
        let x = 35;

        headers.forEach((header, i) => {
          doc.text(header, x, tableTop, {
            width: colWidths[i],
            align: "center"
          });
          x += colWidths[i];
        });

        doc
          .moveTo(35, tableTop + 15)
          .lineTo(765, tableTop + 15)
          .lineWidth(1)
          .stroke();

        doc.font("Helvetica").fontSize(9);
        let y = tableTop + 22;

        lineItems.forEach(item => {
          x = 35;
          const rowData = [
            new Date(item.orderDate).toLocaleDateString("en-IN"),
            item.orderId || "-",
            (item.customerName || item.customerEmail || "Guest").slice(0, 38),
            (item.productName || "-").slice(0, 38),
            (item.variant || "-").slice(0, 32),
            item.quantity.toString(),
            "₹" + Number(item.price || 0).toFixed(2),
            "₹" + Number(item.lineTotal || 0).toFixed(2),
            (item.paymentMethod || "N/A").toUpperCase()
          ];

          rowData.forEach((text, i) => {
            const align = (i === 6 || i === 7) ? "right" : "left";
            doc.text(text, x, y, {
              width: colWidths[i],
              align
            });
            x += colWidths[i];
          });

          y += rowHeight;

          if (y > 520) {
            doc.addPage();
            y = 50;
          }
        });
      }

      doc.end();
      return;
    }

    let csv = "Date,Order ID,Customer Name,Customer Email,Product,Variant,Quantity,Unit Price,Line Total,Payment Method\n";

    lineItems.forEach(item => {
      const date = new Date(item.orderDate).toLocaleDateString("en-IN");
      const row = [
        date,
        item.orderId,
        `"${item.customerName || ""}"`,
        item.customerEmail || "",
        `"${item.productName || ""}"`,
        `"${item.variant || ""}"`,
        item.quantity,
        item.price.toFixed(2),
        item.lineTotal.toFixed(2),
        item.paymentMethod.toUpperCase()
      ].join(",");
      csv += row + "\n";
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=sales-report-${new Date().toISOString().split("T")[0]}.csv`);
    res.send(csv);

  } catch (error) {
    console.error("Download report error:", error);
    res.status(500).json({
      success: false,
      message: "Error downloading report"
    });
  }
};